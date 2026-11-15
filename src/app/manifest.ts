import { getMenu } from "@/cms/repository";
import type { MetadataRoute } from "next";
import { strings } from "@/i18n/copy";
import { requestLang } from "@/i18n/request-lang";
import { currentStorefront } from "@/storefront/server";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { menu } = await getMenu();
  const lang = await requestLang();
  const t = strings(lang, menu.copy);
  const ar = lang === "ar";
  const storefront = await currentStorefront();
  const pickup = storefront.mode === "pickup";
  const name = pickup
    ? ar
      ? "طلب سوشينا"
      : "Sushinaa pickup"
    : ar
      ? "قائمة سوشينا"
      : "Sushinaa menu";
  const description = pickup
    ? ar
      ? "اطلب للاستلام من سوشينا في قطر."
      : "Order Sushinaa for car-collection pickup in Qatar."
    : ar
      ? "قائمة سوشينا في قطر."
      : "Let the good times roll. QR menu for Sushinaa in Qatar.";

  return {
    id: pickup ? "/?storefront=pickup" : "/?storefront=menu",
    name,
    short_name: t.brand,
    description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#14110F",
    theme_color: "#14110F",
    lang: ar ? "ar-QA" : "en-QA",
    dir: ar ? "rtl" : "ltr",
    categories: ["food", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
