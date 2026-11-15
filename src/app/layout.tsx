import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { strings } from "@/i18n/copy";
import { LocaleProvider, SkipLink } from "@/i18n/locale";
import type { Lang } from "@/i18n/localize";
import { requestLang } from "@/i18n/request-lang";
import { getMenu } from "@/cms/repository";
import { publicMenu } from "@/cms/schema";
import { MenuProvider } from "@/cms/context";
import { isProductionDeployment } from "@/lib/deploy-env";
import { InstallPrompt } from "@/components/site/InstallPrompt";
import "./globals.css";

// Read the published menu at request time; preview builds need no database connection.
// getMenu still shares the published snapshot via its existing tagged cache.
export const dynamic = "force-dynamic";

const display = localFont({
  src: [
    { path: "../fonts/KautivaProC-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/KautivaProC-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const sans = localFont({
  src: [
    { path: "../fonts/ZenKakuGothicAntique-Regular.woff2", weight: "400" },
    { path: "../fonts/ZenKakuGothicAntique-Medium.woff2", weight: "500" },
    { path: "../fonts/ZenKakuGothicAntique-Bold.woff2", weight: "700" },
  ],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

const arabic = localFont({
  src: [{ path: "../fonts/ArbFONTS-Greta-Arabic-Medium.woff2", weight: "500" }],
  variable: "--font-arabic",
  display: "swap",
  preload: false,
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { menu } = await getMenu();
  const SITE = menu.settings;
  const lang = await requestLang();
  const ar = lang === "ar";
  const brand = strings(lang, menu.copy).brand;
  const title = ar ? `${brand} · قائمة` : `${brand} · QR menu`;
  const description = ar
    ? `${brand}. قائمة سوشي في قطر. اختر البروتين وعدد القطع والصوص، واحفظ اختياراتك لتعرضها على الموظفين. واتساب ${SITE.whatsappDisplay}.`
    : `${SITE.tagline}. Sushinaa QR menu in Qatar. Pick protein, pieces, and sauces, and save your selections to show staff. WhatsApp ${SITE.whatsappDisplay}.`;
  return {
    metadataBase: new URL(SITE.url),
    title: { default: title, template: `%s · ${brand}` },
    description,
    applicationName: brand,
    keywords: ar
      ? ["سوشينا", "سوشي قطر", "سوشي الدوحة", "قائمة"]
      : ["Sushinaa", "sushi Qatar", "Doha sushi", "QR menu"],
    authors: [{ name: brand }],
    creator: brand,
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: ar ? "ar_QA" : "en_QA",
      url: SITE.url,
      siteName: brand,
      title,
      description: ar
        ? "تصفح قائمة السوشي في قطر. لا يتم الدفع على هذه الصفحة."
        : `${SITE.tagline}. Browse the Sushinaa QR menu in Qatar. No payment on this page.`,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: ar ? `قائمة ${brand}` : `${brand} QR menu` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ar ? "قائمة سوشي في قطر." : `${SITE.tagline}. Sushi QR menu for Qatar.`,
      images: ["/og.jpg"],
    },
    robots: isProductionDeployment()
      ? { index: true, follow: true }
      : { index: false, follow: false },
    // Standalone install comes from the web app manifest (display: standalone).
    // Prefer that over the legacy apple-mobile-web-app-capable meta tag.
    appleWebApp: {
      title: brand,
      statusBarStyle: "black-translucent",
    },
    alternates: { canonical: SITE.url },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14110F",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { menu } = await getMenu();
  const SITE = menu.settings;
  const lang: Lang = await requestLang();
  const ar = lang === "ar";
  const brand = strings(lang, menu.copy).brand;
  const areas = ar ? SITE.areasAr : SITE.areas;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: brand,
    slogan: ar ? "مطبخ سوشي في قطر" : SITE.tagline,
    url: SITE.url,
    telephone: `+${SITE.whatsappE164}`,
    areaServed: areas.map((name) => ({ "@type": "City", name: ar ? `${name}، قطر` : `${name}, Qatar` })),
    address: {
      "@type": "PostalAddress",
      addressLocality: ar ? "الدوحة" : "Doha",
      addressCountry: "QA",
    },
    servesCuisine: ar ? ["سوشي", "ياباني", "قطري"] : ["Sushi", "Japanese", "Qatari"],
    priceRange: "$$",
    sameAs: [SITE.instagram],
  };

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`${display.variable} ${sans.variable} ${arabic.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        {/* Dishes ship only with the menu page (src/app/page.tsx). */}
        <MenuProvider menu={{ ...publicMenu(menu, "menu"), dishes: [] }}>
          <LocaleProvider initial={lang}>
            <SkipLink />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
            />
            {children}
            <InstallPrompt />
            <Analytics />
          </LocaleProvider>
        </MenuProvider>
      </body>
    </html>
  );
}
