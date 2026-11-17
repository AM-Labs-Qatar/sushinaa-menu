"use client";

import { createContext, useContext, type ReactNode } from "react";

const AM_LABS_URL = "https://am-labs-xi.vercel.app";

const ShowAmLabsCredit = createContext(false);

/** Server computes visibility; client trees only read the boolean. */
export function AmLabsCreditProvider({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <ShowAmLabsCredit.Provider value={show}>{children}</ShowAmLabsCredit.Provider>
  );
}

function useShowAmLabsCredit() {
  return useContext(ShowAmLabsCredit);
}

/** Studio credit — cart ticket only (not on the menu scroll). */
export function AmLabsCredit({ placement }: { placement: "ticket" }) {
  if (!useShowAmLabsCredit()) return null;
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
