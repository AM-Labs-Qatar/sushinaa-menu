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
      <img
        className="am-labs-credit-mark"
        src="/brand/am-labs-mark.svg"
        alt=""
        width={14}
        height={14}
      />
      <span>Powered by AM Labs</span>
    </a>
  );
}
