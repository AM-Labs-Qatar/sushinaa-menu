import { createClient } from "@libsql/client";
import { databaseHost, LIVE_DATABASE_HOST } from "../src/lib/deploy-env";
import { CATALOG_SCHEMA, CopyRefused, envMarker, readOnlySource, replaceCatalog } from "./copy-to-dev";

const CONFIRM_VALUE = "sushinaa-cms";

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
      const sourceMarker = await envMarker(sourceRaw);
      if (sourceMarker !== "development") {
        throw new CopyRefused("Refusing. The source marker is not development.");
      }
      const targetMarker = await envMarker(target);
      if (targetMarker === "development") {
        throw new CopyRefused("Refusing. The live target unexpectedly has a development marker.");
      }
    }

    await target.batch(CATALOG_SCHEMA, "write");
    return await replaceCatalog(source, target);
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
