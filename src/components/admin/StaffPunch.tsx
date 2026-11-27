'use client';
import { useEffect, useMemo, useState } from 'react';
import type { MenuData } from '@/cms/schema';
import { publicMenu } from '@/cms/schema';
import type { Dish, Selection } from '@/catalog/types';
import { useLocale } from '@/i18n/locale';
import { configuredBranches } from '@/branches/branches';
import { menuHasOrderingMode } from '@/branches/ordering-modes';
import { choiceGroups, chosen, withChoice } from '@/ordering/choice-groups';
import { formatOrderNumber } from '@/ordering/order-number';
import { defaultSelection, isSelectionComplete, selectionLabel, serializeSelection, unitPrice } from '@/ordering/price';
import { formatMinor } from '@/lib/money';

type PunchLine = {
  key: string;
  dish: Dish;
  selection: Selection;
  quantity: number;
  note: string;
  unitMinor: number;
};

type Props = {
  menu: MenuData;
  branchId?: string;
};

type PlacedCue = { orderNumber: number; plate: string };

function idempotencyKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cloneSel(sel: Selection): Selection {
  return structuredClone(sel);
}

export function StaffPunch({ menu, branchId }: Props) {
  const { lang, t } = useLocale();
  const ar = lang === 'ar';
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const branches = configuredBranches(menu.branches).filter((b) => menuHasOrderingMode(menu.branches, b.slug, 'staff'));
  const [branch, setBranch] = useState(() => branchId && branches.some((b) => b.slug === branchId) ? branchId : branches[0]?.slug ?? '');
  const [plate, setPlate] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lines, setLines] = useState<PunchLine[]>([]);
  const [pick, setPick] = useState<Dish | null>(null);
  const [units, setUnits] = useState<Selection[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [activeUnit, setActiveUnit] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<PlacedCue | null>(null);

  useEffect(() => {
    if (!placed) return;
    const timer = window.setTimeout(() => setPlaced(null), 5000);
    return () => window.clearTimeout(timer);
  }, [placed]);

  const dishes = publicMenu(menu, 'pickup').dishes;
  const categories = useMemo(() => {
    const ids = new Set(dishes.map((d) => d.section));
    return [...menu.categories].filter((c) => ids.has(c.id)).sort((a, b) => a.order - b.order);
  }, [dishes, menu.categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((d) => {
      if (categoryId && d.section !== categoryId) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || d.nameAr.includes(query.trim()) || d.id.includes(q);
    });
  }, [dishes, categoryId, query]);

  const totalMinor = lines.reduce((n, line) => n + line.unitMinor * line.quantity, 0);
  const sel = units[Math.min(activeUnit, Math.max(0, units.length - 1))] ?? {};

  function openDish(dish: Dish) {
    const seed = defaultSelection(dish);
    setPlaced(null);
    setPick(dish);
    setUnits([seed]);
    setNotes(['']);
    setActiveUnit(0);
    setError('');
  }

  function changeQty(next: number) {
    if (!pick) return;
    const count = Math.max(1, Math.min(20, next));
    setUnits((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);
      const seed = prev[prev.length - 1] ?? defaultSelection(pick);
      return [...prev, ...Array.from({ length: count - prev.length }, () => cloneSel(seed))];
    });
    setNotes((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? ''));
    setActiveUnit((i) => Math.min(i, count - 1));
  }

  function setShown(next: Selection) {
    setUnits((prev) => prev.map((item, index) => (index === activeUnit ? next : item)));
  }

  function addLine() {
    if (!pick) return;
    if (!units.every((item) => isSelectionComplete(pick, item))) {
      setError(text('Choose the required options for each item.', 'اختر الخيارات المطلوبة لكل قطعة.'));
      return;
    }
    const stamp = Date.now();
    const merged = new Map<string, PunchLine>();
    units.forEach((selection, index) => {
      const note = (notes[index] ?? '').trim();
      const unitMinor = Math.round(unitPrice(pick, selection) * 100);
      const bucket = `${serializeSelection(selection)}|${note}`;
      const existing = merged.get(bucket);
      if (existing) existing.quantity += 1;
      else {
        merged.set(bucket, {
          key: `${pick.id}-${stamp}-${index}`,
          dish: pick,
          selection,
          quantity: 1,
          note,
          unitMinor,
        });
      }
    });
    setLines((prev) => [...prev, ...merged.values()]);
    setPick(null);
  }

  async function place() {
    if (busy) return;
    const plateValue = plate.trim();
    if (!branch) {
      setError(text('No staff-enabled branch.', 'لا يوجد فرع مفعّل لطلب الموظفين.'));
      return;
    }
    if (!plateValue) {
      setError(text('Enter a plate.', 'أدخل رقم اللوحة.'));
      return;
    }
    if (!lines.length) {
      setError(text('Add at least one item.', 'أضف صنفاً واحداً على الأقل.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branch,
          plate: plateValue,
          instructions: '',
          idempotencyKey: idempotencyKey(),
          lines: lines.map((line) => ({
            dishId: line.dish.id,
            selection: line.selection,
            quantity: line.quantity,
            note: line.note,
            expectedUnitMinor: line.unitMinor,
          })),
        }),
      });
      const body = await response.json() as { id?: string; orderNumber?: number; code?: string };
      if (!response.ok || !body.id || !Number.isSafeInteger(body.orderNumber)) {
        setPlaced(null);
        setError(body.code === 'CLOSED'
          ? text('Branch is outside staff hours.', 'الفرع خارج ساعات عمل الموظفين.')
          : body.code === 'BRANCH_UNAVAILABLE'
            ? text('Staff ordering is off for this branch.', 'طلب الموظفين غير مفعّل لهذا الفرع.')
            : text('Could not place the order.', 'تعذّر إرسال الطلب.'));
        return;
      }
      setLines([]);
      setPlate('');
      setError('');
      setPlaced({ orderNumber: body.orderNumber!, plate: plateValue });
    } catch {
      setPlaced(null);
      setError(text('Could not place the order.', 'تعذّر إرسال الطلب.'));
    } finally {
      setBusy(false);
    }
  }

  if (!branches.length) {
    return <section className="staff-punch" dir={ar ? 'rtl' : 'ltr'}>
      <div className="ops-empty-panel">
        <h2>{text('Staff ordering is off', 'طلب الموظفين غير مفعّل')}</h2>
        <p>{text('Enable staff ordering for a branch under Branches.', 'فعّل طلب الموظفين لفرع من صفحة الفروع.')}</p>
      </div>
    </section>;
  }

  const sheetTotal = pick
    ? Math.round(units.reduce((sum, item) => sum + unitPrice(pick, item), 0) * 100)
    : 0;
  const sheetReady = pick ? units.every((item) => isSelectionComplete(pick, item)) : false;
  const groups = pick ? choiceGroups(pick, sel, lang) : [];

  return <section className="staff-punch" dir={ar ? 'rtl' : 'ltr'} aria-busy={busy}>
    <header className="staff-punch-bar">
      {!branchId && <label className="staff-punch-branch">{text('Branch', 'الفرع')}
        <select value={branch} disabled={busy} onChange={(e) => setBranch(e.target.value)}>
          {branches.map((b) => <option key={b.slug} value={b.slug}>{ar ? b.nameAr : b.name}</option>)}
        </select>
      </label>}
      <div className="staff-punch-search">
        <input
          type="search"
          value={query}
          disabled={busy}
          maxLength={80}
          placeholder={text('Search menu…', 'ابحث في القائمة…')}
          aria-label={text('Search menu', 'البحث في القائمة')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </header>

    <div className="staff-punch-cats" role="tablist" aria-label={text('Categories', 'التصنيفات')}>
      <button type="button" role="tab" aria-selected={!categoryId} disabled={busy} onClick={() => setCategoryId('')}>{text('All', 'الكل')}</button>
      {categories.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={categoryId === c.id} disabled={busy} onClick={() => setCategoryId(c.id)}>
          {ar ? c.nameAr : c.name}
        </button>
      ))}
    </div>

    <div className="staff-punch-layout">
      <div className="staff-punch-catalog" role="list">
        {filtered.map((dish) => {
          const name = ar ? dish.nameAr || dish.name : dish.name;
          const price = formatMinor(Math.round(unitPrice(dish, defaultSelection(dish)) * 100), lang);
          return <button key={dish.id} type="button" className="staff-punch-dish" role="listitem" disabled={busy} onClick={() => openDish(dish)}>
            <span className="staff-punch-dish-name">{name}</span>
            <span className="staff-punch-dish-price" dir="ltr">{price}</span>
          </button>;
        })}
        {!filtered.length && <p className="ops-inline-message">{text('No items match.', 'لا توجد أصناف مطابقة.')}</p>}
      </div>

      <aside className={`staff-punch-cart${placed ? ' is-sent' : ''}`}>
        <h2>{text('Order', 'الطلب')}</h2>
        <ul className="staff-punch-lines">
          {lines.map((line) => {
            const choices = selectionLabel(line.dish, line.selection, lang, t);
            return <li key={line.key}>
              <div>
                <strong>{line.quantity} × {ar ? line.dish.nameAr || line.dish.name : line.dish.name}</strong>
                {choices && <small>{choices}</small>}
                {line.note && <small>{line.note}</small>}
              </div>
              <div className="staff-punch-line-actions">
                <span dir="ltr">{formatMinor(line.unitMinor * line.quantity, lang)}</span>
                <button type="button" disabled={busy} onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}>{text('Remove', 'حذف')}</button>
              </div>
            </li>;
          })}
          {!lines.length && !placed && <li className="staff-punch-empty">{text('Tap items to add them.', 'اضغط على الأصناف لإضافتها.')}</li>}
          {!lines.length && placed && <li className="staff-punch-empty">{text('Ready for the next car.', 'جاهز للسيارة التالية.')}</li>}
        </ul>
        <div className="staff-punch-total">
          <span>{text('Total', 'الإجمالي')}</span>
          <strong dir="ltr">{formatMinor(totalMinor, lang)}</strong>
        </div>
        <label className={`staff-punch-plate${lines.length > 0 && !plate.trim() ? ' is-needed' : ''}`}>{text('Plate', 'اللوحة')}
          <input
            value={plate}
            disabled={busy || Boolean(placed)}
            maxLength={32}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={text('Car plate', 'رقم اللوحة')}
            aria-invalid={lines.length > 0 && !plate.trim()}
            onChange={(e) => { setPlaced(null); setPlate(e.target.value); }}
          />
        </label>
        {error && !pick && <p role="alert" className="staff-error">{error}</p>}
        {lines.length > 0 && !plate.trim() && !error && (
          <p className="staff-punch-need" role="status">{text('Enter a plate to place the order.', 'أدخل رقم اللوحة لإرسال الطلب.')}</p>
        )}
        {placed ? (
          <p className="staff-punch-place is-sent" role="status" aria-live="assertive">
            <strong>{text('Sent to kitchen', 'أُرسل للمطبخ')}</strong>
            <span dir="ltr">#{formatOrderNumber(placed.orderNumber)} · {placed.plate}</span>
          </p>
        ) : (
          <button type="button" className="primary staff-punch-place" disabled={busy || !lines.length || !plate.trim()} onClick={() => void place()}>
            {busy ? text('Sending…', 'جارٍ الإرسال…') : text('Place order', 'إرسال الطلب')}
          </button>
        )}
      </aside>
    </div>

    {pick && <div className="staff-punch-sheet" role="dialog" aria-modal="true" aria-label={ar ? pick.nameAr : pick.name}>
      <div className="staff-punch-sheet-card">
        <header>
          <div>
            <h3>{ar ? pick.nameAr || pick.name : pick.name}</h3>
            <p className="staff-punch-sheet-price" dir="ltr">{formatMinor(sheetTotal, lang)}</p>
          </div>
          <button type="button" onClick={() => setPick(null)}>{text('Close', 'إغلاق')}</button>
        </header>

        {units.length > 1 && (
          <div className="staff-punch-units">
            <p>{text('Customize each', 'خصّص كل قطعة')}</p>
            <div role="tablist" aria-label={text('Items', 'القطع')}>
              {units.map((item, index) => {
                const on = index === activeUnit;
                const done = isSelectionComplete(pick, item);
                return <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`staff-punch-unit${on ? ' is-on' : ''}${done ? '' : ' is-warn'}`}
                  onClick={() => setActiveUnit(index)}
                >{index + 1}</button>;
              })}
            </div>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.key} className="staff-punch-options">
            <p>{group.label}{units.length > 1 ? ` · #${activeUnit + 1}` : ''}</p>
            <div className="staff-punch-opts" role={group.multi ? 'group' : 'radiogroup'} aria-label={group.label}>
              {group.options.map((option) => {
                const on = group.multi
                  ? ((sel[group.key as keyof Selection] as string[] | undefined) ?? []).includes(option.value)
                  : chosen(sel, group.key) === option.value;
                return <button
                  type="button"
                  key={option.value}
                  role={group.multi ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  className={`staff-punch-opt${on ? ' is-on' : ''}`}
                  onClick={() => setShown(withChoice(pick, sel, group.key, option.value))}
                >
                  <span>{option.label}</span>
                  {option.priceQar != null && option.priceQar > 0 && (
                    <em dir="ltr">+{option.priceQar}</em>
                  )}
                </button>;
              })}
            </div>
          </div>
        ))}

        <label className="staff-punch-note">{units.length > 1
          ? text(`Note · item ${activeUnit + 1}`, `ملاحظة · قطعة ${activeUnit + 1}`)
          : text('Note', 'ملاحظة')}
          <input
            value={notes[activeUnit] ?? ''}
            maxLength={400}
            onChange={(e) => {
              const value = e.target.value;
              setNotes((prev) => prev.map((note, index) => (index === activeUnit ? value : note)));
            }}
          />
        </label>

        {error && <p role="alert" className="staff-error">{error}</p>}

        <div className="staff-punch-sheet-foot">
          <div className="staff-punch-stepper">
            <button type="button" disabled={units.length <= 1} onClick={() => changeQty(units.length - 1)} aria-label={text('Decrease', 'إنقاص')}>−</button>
            <span>{units.length}</span>
            <button type="button" onClick={() => changeQty(units.length + 1)} aria-label={text('Increase', 'زيادة')}>+</button>
          </div>
          <button type="button" className="primary" disabled={!sheetReady} onClick={addLine}>
            {text('Add', 'إضافة')} · <span dir="ltr">{formatMinor(sheetTotal, lang)}</span>
          </button>
        </div>
      </div>
    </div>}
  </section>;
}
