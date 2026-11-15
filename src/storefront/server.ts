import { headers } from "next/headers";
import { storefrontFromHost, type Storefront } from "./resolve";

/** Storefront for the current App Router request. */
export async function currentStorefront(): Promise<Storefront> {
  const h = await headers();
  return storefrontFromHost(h.get("x-forwarded-host") ?? h.get("host"));
}
