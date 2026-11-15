"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/locale";
import "./install-prompt.css";

const DISMISS_KEY = "sushinaa-a2hs-dismissed";

function isStandaloneDisplay(): boolean {
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function readEligible(): boolean {
  if (isStandaloneDisplay()) return false;
  if (localStorage.getItem(DISMISS_KEY) === "1") return false;
  return isIosDevice();
}

const emptySubscribe = () => () => {};

/**
 * Guides iPhone/iPad users to Share → Add to Home Screen.
 * Hidden when already installed or after dismiss.
 */
export function InstallPrompt() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const eligible = useSyncExternalStore(emptySubscribe, readEligible, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!eligible || dismissed) return null;

  return (
    <aside className="a2hs" role="region" aria-label={text("Add to Home Screen", "إضافة إلى الشاشة الرئيسية")}>
      <div className="a2hs-copy">
        <strong>{text("Add Sushinaa to your Home Screen", "أضف سوشينا إلى شاشتك الرئيسية")}</strong>
        <p>
          {text(
            "Tap Share, then Add to Home Screen for a full-screen menu.",
            "اضغط مشاركة، ثم إضافة إلى الشاشة الرئيسية لفتح القائمة بملء الشاشة.",
          )}
        </p>
      </div>
      <button
        type="button"
        className="a2hs-dismiss"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
      >
        {text("Not now", "ليس الآن")}
      </button>
    </aside>
  );
}
