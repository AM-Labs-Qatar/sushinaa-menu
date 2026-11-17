import { showAmLabsCredit } from "@/lib/deploy-env";

const AM_LABS_URL = "https://amlabs.com";

/** Dev / test-dev only — omitted on the live restaurant database. */
export function AmLabsCredit() {
  if (!showAmLabsCredit()) return null;
  return (
    <a
      className="am-labs-credit"
      href={AM_LABS_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Powered by AM Labs
    </a>
  );
}
