/**
 * Next compiles the trailing-slash 308 into the server. That redirect runs
 * before proxy, so a direct call to the route handler cannot see it.
 * This file boots `next start` and compares the two POST URLs there.
 * It rebuilds when the routing sources are newer than `.next/BUILD_ID`.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const POS_KEY = "test-pos-key";
const ROUTING_SOURCES = [
  "next.config.ts",
  "src/proxy.ts",
  "src/app/api/pos/orders/route.ts",
  "src/app/api/pos/orders/[id]/accepted/route.ts",
];

let dir: string;
let port: number;
let server: ChildProcess | undefined;

function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    CMS_DATABASE_URL: `file:${join(dir, "orders.db")}`,
    CMS_DATABASE_AUTH_TOKEN: "",
    CMS_ENV_GUARD: "report",
    OXIPOS_API_KEY: POS_KEY,
    OXIPOS_SHOP_IDS: JSON.stringify({ "down-town": "101" }),
  };
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  delete env.STOREFRONT_MODE;
  return env;
}

function routingBuildStale() {
  const buildId = join(root, ".next", "BUILD_ID");
  if (!existsSync(buildId)) return true;
  const built = statSync(buildId).mtimeMs;
  return ROUTING_SOURCES.some(
    (rel) => statSync(join(root, rel)).mtimeMs > built,
  );
}

function runNext(args: string[]) {
  return spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), ...args], {
    cwd: root,
    env: childEnv(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (!address || typeof address === "string") {
        srv.close();
        reject(new Error("no port"));
        return;
      }
      const chosen = address.port;
      srv.close(() => resolve(chosen));
    });
  });
}

type RawResponse = { status: number; headers: IncomingHttpHeaders; body: string };

function raw(
  method: string,
  path: string,
  headers: Record<string, string | number>,
  body?: string,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: "127.0.0.1", port, path, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.setTimeout(15_000, () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitUntilServing(child: ChildProcess) {
  let logs = "";
  const take = (chunk: Buffer) => {
    logs = (logs + chunk.toString()).slice(-4000);
  };
  child.stdout?.on("data", take);
  child.stderr?.on("data", take);
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited ${child.exitCode}\n${logs}`);
    }
    try {
      await raw("GET", "/", {});
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`next start did not accept connections\n${logs}`);
}

function locationPath(location: IncomingHttpHeaders["location"], basePath: string) {
  const rawLocation = Array.isArray(location) ? location[0] : location;
  assert.equal(typeof rawLocation, "string");
  return new URL(rawLocation, `http://127.0.0.1:${port}${basePath}`).pathname;
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "sn-pos-slash-"));
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.STOREFRONT_MODE;
  Object.assign(process.env, childEnv());

  const { menuSchema } = await import("../src/cms/schema");
  const { checkoutSchema } = await import("../src/ordering/checkout/validation");
  const { quoteOrder } = await import("../src/ordering/checkout/quote");
  const { defaultSelection, unitPrice } = await import("../src/ordering/price");
  const { ORDER_SURFACE_RESTAURANT } = await import("../src/ordering/surface");
  const { seedMenu } = await import("../src/cms/repository");
  const { persistPendingOrder } = await import("../src/ordering/checkout/repository");

  const menu = menuSchema.parse(
    JSON.parse(readFileSync(join(root, "data/initial-menu.json"), "utf8")),
  );
  const dish = menu.dishes.find(
    (item) =>
      item.channels.pickup.visible &&
      item.channels.pickup.available &&
      item.kind.type === "simple",
  );
  if (!dish) throw new Error("no simple dish in initial menu");
  const picked = dish;
  picked.posSku = "SKU-SLASH-HTTP";
  await seedMenu(menu);

  let plateN = 1000;
  async function place(name: string) {
    plateN += 1;
    const selection = defaultSelection(picked);
    const input = checkoutSchema.parse({
      branchId: "down-town",
      paymentMethod: "pay_at_pickup",
      customer: {
        name,
        phone: "97455551234",
        brand: "toyota",
        plate: `Q${plateN}`,
        colour: "",
        car: "",
        instructions: "",
      },
      lines: [
        {
          dishId: picked.id,
          selection,
          quantity: 1,
          note: "",
          expectedUnitMinor: Math.round(unitPrice(picked, selection) * 100),
        },
      ],
    });
    const snapshot = await quoteOrder(
      input,
      menu,
      new Date("2026-10-22T15:00:00+03:00"),
    );
    await persistPendingOrder(
      randomBytes(32).toString("hex"),
      `pos-${randomUUID()}`.slice(0, 80),
      `hash-${name}`,
      snapshot,
      1,
      "pay_at_pickup",
      ORDER_SURFACE_RESTAURANT,
    );
  }

  await place("Slash Guest");
  await place("Plain Guest");

  if (routingBuildStale()) {
    const built = runNext(["build"]);
    if (built.status !== 0) {
      const output = `${built.stdout ?? ""}\n${built.stderr ?? ""}`.slice(-4000);
      throw new Error(`next build failed (${built.status})\n${output}`);
    }
  }

  port = await freePort();
  server = spawn(
    process.execPath,
    [
      join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--port",
      String(port),
      "--hostname",
      "127.0.0.1",
    ],
    { cwd: root, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] },
  );
  await waitUntilServing(server);
});

after(() => {
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test("POST accepted with and without a trailing slash returns the same 2xx body", async () => {
  const headers = { "x-pos-api-key": POS_KEY };
  const listed = await raw("GET", "/api/pos/orders?shop_id=101", headers);
  assert.equal(listed.status, 200, listed.body.slice(0, 300));
  const orders = JSON.parse(listed.body) as { id: number; customer_name: string }[];
  assert.ok(Array.isArray(orders));
  const slashId = orders.find((order) => order.customer_name === "Slash Guest")?.id;
  const plainId = orders.find((order) => order.customer_name === "Plain Guest")?.id;
  assert.equal(typeof slashId, "number");
  assert.equal(typeof plainId, "number");

  const postHeaders = {
    ...headers,
    "content-type": "application/json",
    "content-length": Buffer.byteLength("{}"),
  };
  const slashed = await raw(
    "POST",
    `/api/pos/orders/${slashId}/accepted/`,
    postHeaders,
    "{}",
  );
  const plain = await raw(
    "POST",
    `/api/pos/orders/${plainId}/accepted`,
    postHeaders,
    "{}",
  );

  assert.ok(slashed.status >= 200 && slashed.status < 300, `slash ${slashed.status} ${slashed.body}`);
  assert.ok(plain.status >= 200 && plain.status < 300, `plain ${plain.status} ${plain.body}`);
  assert.equal(slashed.status, plain.status);
  assert.equal(slashed.body, plain.body);
  assert.equal(slashed.headers.location, undefined);
  assert.equal(plain.headers.location, undefined);
});

test("GET /down-town/ still 308s to the no-slash path", async () => {
  const res = await raw("GET", "/down-town/?x=1", {});
  assert.equal(res.status, 308);
  assert.equal(locationPath(res.headers.location, "/down-town/?x=1"), "/down-town");
  const loc = new URL(
    String(res.headers.location),
    `http://127.0.0.1:${port}/down-town/?x=1`,
  );
  assert.equal(loc.search, "?x=1");
});
