import { createHash, timingSafeEqual } from "node:crypto";
import { oxiposApiKey } from "./config";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Validates OXiPOS shared secret. Returns false when key unset or mismatch.
 * Compares fixed-length digests in constant time so the key cannot be guessed byte by byte.
 */
export function oxiposAuthorized(request: Request): boolean {
  const expected = oxiposApiKey();
  if (!expected) return false;
  const got = request.headers.get("x-pos-api-key")?.trim() || "";
  if (!got) return false;
  return timingSafeEqual(digest(got), digest(expected));
}
