import { oxiposApiKey } from "./config";

/** Validates OXiPOS shared secret. Returns false when key unset or mismatch. */
export function oxiposAuthorized(request: Request): boolean {
  const expected = oxiposApiKey();
  if (!expected) return false;
  const got = request.headers.get("x-pos-api-key")?.trim() || "";
  return got.length > 0 && got === expected;
}
