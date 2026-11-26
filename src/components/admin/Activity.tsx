"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale";
import { formatQatarDateTime } from "@/lib/datetime";
import { formatOrderNumber } from "@/ordering/order-number";
import { staffOrderRef } from "@/ordering/staff-order-ref";
import { HISTORY_DISPLAY_DAYS } from "@/ordering/history-window";
import { useNotify } from "./Notices";

type Row = {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  label: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  orderNumber?: number | null;
  paymentReference?: string | null;
};
const AREAS = [
  ["", "All"],
  ["sessions", "Sign-ins"],
  ["items", "Items"],
  ["categories", "Categories"],
  ["branches", "Branches"],
  ["settings", "Settings"],
  ["media", "Photos"],
  ["orders", "Orders"],
] as const;
const FIELDS: Record<string, string> = {
  phone: "phone number",
  hours: "opening hours",
  name: "name",
  nameAr: "Arabic name",
  description: "description",
  descriptionAr: "Arabic description",
  section: "category",
  image: "card photo",
  optionsImage: "options photo",
  imageFocus: "focal point",
  imageAlt: "photo description",
  imageAltAr: "Arabic photo description",
  kind: "price and options",
  extras: "extras",
  freeDips: "free dips",
  piecesNote: "pieces note",
  order: "position",
  visible: "visibility",
  available: "availability",
  featured: "featured",
  tags: "tags",
  logo: "menu logo",
  documentLogo: "document logo",
  whatsappE164: "WhatsApp number",
};
const field = (key: string) =>
  FIELDS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const noun: Record<string, string> = {
  branch: "branch",
  item: "item",
  category: "category",
  filter: "filter",
};
const SECTIONS: Record<string, string> = {
  settings: "Changed settings",
  copy: "Changed menu wording",
  fields: "Changed field names",
};

export function describe(row: Row, lang: "en" | "ar" = "en") {
  const [, verb] = row.action.split(".");
  const name = `“${row.label ?? row.entityId}”`;
  const changed = row.diff ? Object.keys(row.diff).map(field).join(", ") : "";
  const orderRef = staffOrderRef(row.orderNumber, row.paymentReference, row.entityId, lang);
  switch (row.action) {
    case "order.status": return `${lang === "ar" ? "تم تغيير حالة الطلب" : "Order status changed"}: ${orderRef}`;
    case "order.contact_viewed": return `${lang === "ar" ? "تم عرض بيانات التواصل للطلب" : "Order contact viewed"}: ${orderRef}`;
    case "order.created": return `Order created: ${orderRef}`;
    case "order.edited": return `Order edited: ${orderRef}`;
    case "order.adjustment_settled": return `Cash returned: ${orderRef}`;
    case "session.sign_in": return "Signed in";
    case "session.sign_out": return "Signed out";
    case "session.sign_in_failed": return "Failed sign-in";
    case "media.upload": return `Uploaded a photo${row.label ? ` (${row.label})` : ""}`;
    case "settings.update": return `${SECTIONS[row.entityType] ?? "Changed settings"}: ${changed}`;
  }
  const what = noun[row.entityType] ?? row.entityType;
  return (
    {
      create: `Added ${what} ${name}`,
      delete: `Deleted ${what} ${name}`,
      hide: `Hid ${what} ${name}`,
      show: `Showed ${what} ${name}`,
      reorder: `Moved ${what} ${name}`,
      update: `Changed ${what} ${name}: ${changed}`,
    }[verb] ?? row.action
  );
}

const show = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s === undefined || s === "null" || s === "") return "—";
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

function changes(row: Row) {
  if (!row.diff || row.action === "media.upload" || "after" in row.diff || "before" in row.diff)
    return [];
  return Object.entries(row.diff as Record<string, { from: unknown; to: unknown }>);
}

function detailLine(row: Row) {
  const bits: string[] = [];
  if (row.action !== "session.sign_in_failed" && row.actor) bits.push(row.actor);
  if (row.orderNumber != null) bits.push(`#${formatOrderNumber(row.orderNumber)}`);
  if (row.paymentReference) bits.push(row.paymentReference);
  for (const [key, change] of changes(row)) bits.push(`${field(key)}: ${show(change.from)}→${show(change.to)}`);
  if (row.ip) bits.push(row.ip);
  return bits.join(" · ");
}

export function Activity() {
  const { lang } = useLocale();
  const [area, setArea] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: Row[]; more: boolean } | null>(null);
  const notify = useNotify();
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/activity?area=${area}&page=${page}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (live) setData(body);
      })
      .catch(
        (e) =>
          live &&
          notify({
            tone: "error",
            text: e instanceof Error ? e.message : "Unable to load activity",
          }),
      );
    return () => {
      live = false;
    };
  }, [area, page, notify]);
  return (
    <section className="admin-activity-dense" dir="ltr">
      <div className="admin-activity-dense-bar">
        <select
          aria-label="Show activity for"
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setPage(1);
          }}
        >
          {AREAS.map(([value, text]) => (
            <option key={value} value={value}>
              {value === "orders" && lang === "ar" ? "Orders" : text}
            </option>
          ))}
        </select>
        <span className="admin-activity-dense-note">Last {HISTORY_DISPLAY_DAYS} days</span>
      </div>
      {data && !data.rows.length && (
        <p className="admin-empty">Nothing in the last {HISTORY_DISPLAY_DAYS} days.</p>
      )}
      {data && data.rows.length > 0 && (
        <div className="admin-activity-table-wrap">
          <table className="admin-activity-table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody className="admin-activity">
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <time dateTime={row.at} title={`${row.at} UTC`}>
                      {formatQatarDateTime(row.at)}
                    </time>
                  </td>
                  <td>{describe(row, lang)}</td>
                  <td className="admin-activity-detail">{detailLine(row) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (page > 1 || data.more) && (
        <nav className="admin-pager" aria-label="Activity pages">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <span>Page {page}</span>
          <button disabled={!data.more} onClick={() => setPage(page + 1)}>
            Older
          </button>
        </nav>
      )}
    </section>
  );
}
