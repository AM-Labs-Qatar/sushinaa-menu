"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale";
import "./install-prompt.css";

const DISMISS_KEY = "sushinaa-a2hs-dismissed";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Guides iPhone/iPad users to Share → Add to Home Screen.
 * Hidden when already installed or after dismiss.
 */
export function InstallPrompt() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (!isIosDevice()) return;
    setShow(true);
  }, []);

  if (!show) return null;

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
          setShow(false);
        }}
      >
        {text("Not now", "ليس الآن")}
      </button>
    </aside>
  );
}
