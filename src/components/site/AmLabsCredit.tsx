const AM_LABS_URL = "https://am-labs-xi.vercel.app";

type Placement = "branch" | "ticket";

/** Studio credit — branch picker and cart ticket, on every deployment. */
export function AmLabsCredit({ placement }: { placement: Placement }) {
  return (
    <a
      className={`am-labs-credit am-labs-credit--${placement}`}
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
