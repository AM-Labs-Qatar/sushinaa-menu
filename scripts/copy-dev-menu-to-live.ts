import { createClient, type Client, type InValue } from "@libsql/client";
import { databaseHost, LIVE_DATABASE_HOST } from "../src/lib/deploy-env";
import { CopyRefused, MEDIA_SQL, MENU_SQL, readOnlySource } from "./copy-to-dev";

const CONFIRM_VALUE = "sushinaa-cms";

const LIVE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS menu (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, content TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, content BLOB NOT NULL, type TEXT NOT NULL)`,
];

async function marker(client: Client): Promise<string | null> {
  try {
    const result = await client.execute("SELECT environment FROM env_marker WHERE id = 1");
    const value = result.rows[0]?.environment;
    return typeof value === "string" ? value : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) return null;
    throw error;
  }
}

export type PromoteEndpoints = {
  sourceUrl: string;
  sourceToken?: string;
  targetUrl: string;
  targetToken?: string;
  confirm?: string;
  /** Tests copy between file databases. The CLI never sets this. */
  allowFileFixture?: boolean;
};

/**
 * Promote catalog (menu + media) from the development Turso database onto live.
 * Does not touch orders, payments, sessions, audit, login_attempts, staff,
 * coupons, or env_marker on live. See `docs/data-kinds.md`.
 */
export async function copyDevMenuToLive(endpoints: PromoteEndpoints) {
  if (endpoints.confirm !== CONFIRM_VALUE) {
    throw new CopyRefused(`Set CONFIRM_LIVE_MENU_COPY=${CONFIRM_VALUE} to write menu/media to live.`);
  }
  if (endpoints.sourceUrl === endpoints.targetUrl) {
    throw new CopyRefused("Source and target must be different databases.");
  }

  const sourceHost = databaseHost(endpoints.sourceUrl);
  const targetHost = databaseHost(endpoints.targetUrl);
  const fileFixture =
    endpoints.allowFileFixture &&
    endpoints.sourceUrl.startsWith("file:") &&
    endpoints.targetUrl.startsWith("file:");

  if (!fileFixture) {
    if (targetHost !== LIVE_DATABASE_HOST) {
      throw new CopyRefused("The target must be the live database.");
    }
    if (!sourceHost || sourceHost === LIVE_DATABASE_HOST) {
      throw new CopyRefused("The source must be the development database.");
    }
  }

  const sourceRaw = createClient({ url: endpoints.sourceUrl, authToken: endpoints.sourceToken });
  const source = readOnlySource(sourceRaw);
  const target = createClient({ url: endpoints.targetUrl, authToken: endpoints.targetToken });
  try {
    if (!fileFixture) {
      const sourceMarker = await marker(sourceRaw);
      if (sourceMarker !== "development") {
        throw new CopyRefused("Refusing. The source marker is not development.");
      }
      const targetMarker = await marker(target);
      if (targetMarker === "development") {
        throw new CopyRefused("Refusing. The live target unexpectedly has a development marker.");
      }
    }

    await target.batch(LIVE_SCHEMA, "write");

    const menu = await source.execute(MENU_SQL);
    const media = await source.execute(MEDIA_SQL);
    const row = menu.rows[0];
    if (!row) throw new CopyRefused("The source menu row is missing.");

    const statements: { sql: string; args: InValue[] }[] = [
      { sql: "DELETE FROM media", args: [] },
      { sql: "DELETE FROM menu", args: [] },
      {
        sql: "INSERT INTO menu (id, revision, content) VALUES (?, ?, ?)",
        args: [Number(row.id), Number(row.revision), String(row.content)],
      },
    ];
    for (const item of media.rows) {
      const bytes = item.content;
      const blob =
        bytes instanceof Uint8Array
          ? bytes
          : bytes instanceof ArrayBuffer
            ? new Uint8Array(bytes)
            : typeof bytes === "string"
              ? Buffer.from(bytes)
              : null;
      if (!blob) throw new CopyRefused("A media row has no content.");
      statements.push({
        sql: "INSERT INTO media (id, content, type) VALUES (?, ?, ?)",
        args: [String(item.id), blob, String(item.type)],
      });
    }
    await target.batch(statements, "write");
    const content = JSON.parse(String(row.content)) as { dishes?: unknown[] };
    return {
      revision: Number(row.revision),
      dishes: Array.isArray(content.dishes) ? content.dishes.length : 0,
      media: media.rows.length,
    };
  } finally {
    source.close();
    target.close();
  }
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new CopyRefused("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL.");
  }
  const result = await copyDevMenuToLive({
    sourceUrl,
    sourceToken: process.env.SOURCE_DATABASE_AUTH_TOKEN,
    targetUrl,
    targetToken: process.env.TARGET_DATABASE_AUTH_TOKEN,
    confirm: process.env.CONFIRM_LIVE_MENU_COPY,
  });
  process.stdout.write(
    `Promoted menu revision ${result.revision}, ${result.dishes} dishes, ${result.media} media rows to live.\n`,
  );
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Promote failed."}\n`);
    process.exitCode = 1;
  });
}
