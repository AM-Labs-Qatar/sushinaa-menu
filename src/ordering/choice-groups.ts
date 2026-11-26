import type { Dish, Selection } from "@/catalog/types";
import { preferredPieces } from "@/ordering/price";

export type ChoiceOption = { value: string; label: string; priceQar?: number };
export type ChoiceGroup = {
  key: string;
  label: string;
  options: ChoiceOption[];
  multi?: boolean;
};

/** Option groups for staff punch / order edits — one shape for every dish kind. */
export function choiceGroups(dish: Dish, sel: Selection, lang: "en" | "ar"): ChoiceGroup[] {
  const n = (en?: string, ar?: string) => (lang === "ar" ? ar || en || "" : en || "");
  const kind = dish.kind;
  const groups: ChoiceGroup[] = [];
  const add = (key: string, label: string, options: ChoiceOption[], multi = false) => {
    if (options.length) groups.push({ key, label, options, multi });
  };
  if (kind.type === "roll") {
    add("protein", n("Protein", "البروتين"), kind.proteins.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    const protein = kind.proteins.find((item) => item.id === sel.protein) ?? kind.proteins[0];
    if (protein) {
      add(
        "pieces",
        n("Pieces", "القطع"),
        Object.entries(protein.prices).map(([count, price]) => ({ value: count, label: count, priceQar: price })),
      );
    }
    if (kind.topping) add("topping", n(kind.topping.name, kind.topping.nameAr), kind.topping.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    if (kind.style) add("style", n(kind.style.name, kind.style.nameAr), kind.style.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === "sauce-price") {
    add("sauce", n("Sauce", "الصلصة"), kind.sauces.map((item) => ({ value: item.id, label: n(item.name, item.nameAr), priceQar: item.priceQar })));
  } else if (kind.type === "spicy-toggle") {
    add("spicy", n("Heat", "الحرارة"), [
      { value: "0", label: n("Mild", "عادي"), priceQar: kind.mildQar },
      { value: "1", label: n("Spicy", "حار"), priceQar: kind.spicyQar },
    ]);
  } else if (kind.type === "size-price") {
    add("size", n("Size", "الحجم"), kind.sizes.map((item) => ({ value: item.id, label: n(item.name, item.nameAr), priceQar: item.priceQar })));
    if (kind.flavors) add("flavor", n(kind.flavors.name, kind.flavors.nameAr), kind.flavors.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === "deal-box") {
    add("starter", n("Starter", "المقبلات"), kind.starters.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
    add("sushi", n("Sushi", "السوشي"), kind.sushi.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  } else if (kind.type === "party-box") {
    add("starters", n("Starters", "المقبلات"), kind.starters.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })), true);
  } else if (kind.type === "addons") {
    if (kind.spicyOptional) add("spicy", n("Heat", "الحرارة"), [{ value: "0", label: n("Mild", "عادي") }, { value: "1", label: n("Spicy", "حار") }]);
    if (kind.includedPicks) add("picks", n(kind.includedPicks.name, kind.includedPicks.nameAr), kind.includedPicks.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })), true);
    kind.freeChoices?.forEach((group) => add(group.id, n(group.name, group.nameAr), group.options.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) }))));
  }
  if (dish.freeDips?.length) add("dip", n("Dip", "التغميس"), dish.freeDips.map((item) => ({ value: item.id, label: n(item.name, item.nameAr) })));
  const extras = kind.type === "addons" ? kind.extras : dish.extras;
  if (extras?.length) {
    add(
      "extras",
      n("Extras", "إضافات"),
      extras.map((item) => ({ value: item.id, label: n(item.name, item.nameAr), priceQar: item.priceQar })),
      true,
    );
  }
  return groups;
}

export function chosen(sel: Selection, key: string) {
  if (key === "spicy") return sel.spicy ? "1" : "0";
  if (key === "pieces") return sel.pieces == null ? "" : String(sel.pieces);
  const value = sel[key as keyof Selection];
  return typeof value === "string" ? value : "";
}

export function withChoice(dish: Dish, sel: Selection, key: string, value: string): Selection {
  const next: Selection = { ...sel };
  if (key === "spicy") next.spicy = value === "1";
  else if (key === "pieces") next.pieces = Number(value) as Selection["pieces"];
  else if (key === "extras" || key === "starters" || key === "picks") {
    const current = (next[key] ?? []) as string[];
    next[key] = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  } else {
    (next as Record<string, unknown>)[key] = value;
  }
  if (key === "protein" && dish.kind.type === "roll") {
    const protein = dish.kind.proteins.find((item) => item.id === value);
    if (protein) next.pieces = preferredPieces(protein.prices);
  }
  return next;
}
