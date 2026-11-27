'use client';
import Image from 'next/image';
import { useLocale } from '@/i18n/locale';
import { stageTimes } from '@/ordering/operations-time';
import { carBrandName,findCarBrand } from '@/ordering/car-brands';
import { CarBrandLogo } from '@/components/checkout/CarBrandPicker';
import { useAdminClock } from './OperationsUI';
import { useEffect, useState } from 'react';
import { configuredBranches } from '@/branches/branches';
import { useMenu } from '@/cms/context';
import { strings } from '@/i18n/copy';
import { useNotify } from './Notices';
import { StatusBadge } from './StatusBadge';
import { closeLiveDetailOnRefresh } from '@/ordering/live-detail-close';
import { allowedTransitions, staffStatus, staffLabels, terminalStatuses, type OrderStatus } from '@/ordering/status';
import { parseSplitCashMajor, sanitizeCashMajorInput, singleTender, type TenderLine } from '@/ordering/counter-tender';
import { formatQatarDateTime } from '@/lib/datetime';
import { formatMinor } from '@/lib/money';
import { formatOrderNumber } from '@/ordering/order-number';
import { nationalPhone } from '@/ordering/checkout/validation';
import { orderTotals } from '@/ordering/edits';
import { imageFor,selectionLabel } from '@/ordering/price';
import type { Dish } from '@/catalog/types';
import { printTicket } from './print-ticket';
import { OrderEditPanel } from './OrderEditPanel';
import { cancellationReasons, type OrderDetailData } from '@/ordering/contracts';
import type { Role } from '@/cms/permissions';
import type { MenuData } from '@/cms/schema';

function spacedPhone(phone: string) {
  const local = nationalPhone(phone);
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : local;
}
function lineChoices(line: OrderDetailData['currentLines'][number], menu: MenuData, lang: 'en' | 'ar', t: Parameters<typeof selectionLabel>[3]) {
  const stored = line as OrderDetailData['currentLines'][number] & Partial<Pick<Dish, 'kind' | 'freeDips' | 'extras'>>;
  const dish = stored.kind ? stored : menu.dishes.find((item) => item.id === line.dishId);
  if (!dish?.kind) return [];
  return selectionLabel({ kind: dish.kind, freeDips: dish.freeDips, extras: dish.extras }, line.selection, lang, t).split(' · ').map((part) => part.trim()).filter(Boolean);
}

export function OrderDetail({ id, onBack, onChange, role, menu, refreshKey=0, closeOnTerminal=false }: { id: string; onBack: () => void; onChange: () => void; role: Role; menu: MenuData; refreshKey?:number; closeOnTerminal?: boolean }) {
  const { copy } = useMenu();
  const branches = configuredBranches(menu.branches);
  const {lang}=useLocale();
  const now=useAdminClock();
  const t = strings(lang, copy);
  const text = (en: string, ar?: string) => lang==='ar'?(ar??en):en;
  const notify = useNotify();
  const reasons = { customer_request: text('Customer request', 'طلب العميل'), unavailable: text('Item unavailable', 'الصنف غير متوفر'), duplicate: text('Duplicate order', 'طلب مكرر'), branch_closed: text('Branch closed', 'الفرع مغلق') };
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState<typeof cancellationReasons[number]>('customer_request');
  const [tenderOpen, setTenderOpen] = useState(false);
  const [tenderMode, setTenderMode] = useState<'cash' | 'card' | 'split'>('cash');
  const [cashMajor, setCashMajor] = useState('');
  async function load() {
    const response = await fetch(`/api/admin/orders/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error('LOAD_FAILED');
    setData(body);
  }
  useEffect(() => { let live = true;
    fetch(`/api/admin/orders/${id}`, { cache: 'no-store' }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.code); if (live) setData(b); }).catch(() => live && setError('LOAD_FAILED'));
    return () => { live = false; };
  }, [id, lang]);
  useEffect(()=>{
    if(!refreshKey)return;let live=true;
    fetch(`/api/admin/orders/${id}`,{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw Error('LOAD_FAILED');const latest=await response.json() as OrderDetailData;
      if(!live)return;
      if(closeLiveDetailOnRefresh(latest.status,closeOnTerminal)){onBack();return;}
      setData(latest);
    }).catch(()=>{if(live)setError('LOAD_FAILED');});return()=>{live=false;};
  },[id,refreshKey]);
  useEffect(() => {
    if (data?.status !== 'accepted') return;
    let stop = false;
    void postStatus('preparing', 'accepted').then(async () => {
      if (stop) return;
      await load();
      onChange();
    }).catch(() => undefined);
    return () => { stop = true; };
  }, [data?.status, id]);
  async function sendKitchenPrint(mode: 'manual' | 'reprint') {
    const claim = await fetch(`/api/staff/orders/${id}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
    const body = await claim.json() as { claimId?: string };
    if (!claim.ok || !body.claimId) throw new Error('PRINT_FAILED');
    await printTicket(id);
    const done = await fetch(`/api/staff/orders/${id}/print/done`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimId: body.claimId }) });
    if (!done.ok) throw new Error('PRINT_FAILED');
    notify({ tone: 'ok', text: text('Ticket sent to print', 'تم إرسال التذكرة للطباعة') });
    await load(); onChange();
  }
  async function printNow(mode: 'manual' | 'reprint') {
    if (busy) return;
    setBusy(true); setError('');
    try { await sendKitchenPrint(mode); }
    catch { setError('PRINT_FAILED'); }
    finally { setBusy(false); }
  }
  async function postStatus(to: OrderStatus, expected: string, extra: Record<string, unknown> = {}) {
    const response = await fetch(`/api/admin/orders/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, expected, ...extra }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.code === 'STALE_STATUS' ? 'STALE_STATUS' : 'UPDATE_FAILED');
  }
  function tendersForCollect(): TenderLine[] | null {
    if (!data) return null;
    if (tenderMode === 'cash' || tenderMode === 'card') return singleTender(tenderMode, data.totalMinor);
    const parsed = parseSplitCashMajor(cashMajor, data.totalMinor);
    if (!parsed.ok) return null;
    return [
      { kind: 'cash', amountMinor: parsed.cashMinor },
      { kind: 'card', amountMinor: parsed.cardMinor },
    ];
  }

  const splitParse = data && tenderMode === 'split' ? parseSplitCashMajor(cashMajor, data.totalMinor) : null;
  const splitHint = !splitParse || splitParse.ok || !cashMajor.trim() ? ''
    : splitParse.reason === 'invalid' ? text('Enter a valid amount (up to 2 decimals).', 'أدخل مبلغاً صحيحاً (حتى منزلتين عشريتين).')
    : splitParse.reason === 'too_small' ? text('Cash must be more than 0.', 'يجب أن يكون النقد أكبر من ٠.')
    : text('Cash must be less than the total so card can take the rest.', 'يجب أن يكون النقد أقل من الإجمالي حتى تأخذ البطاقة الباقي.');

  async function change(to: OrderStatus, extra: Record<string, unknown> = {}) {
    if (!data || busy) return;
    if (to === 'completed' && data.tendersRequired && !extra.tenders) {
      setTenderOpen(true);
      setTenderMode('cash');
      setCashMajor('');
      return;
    }
    setBusy(true); setError('');
    try {
      await postStatus(to, data.status, {
        ...(to === 'completed' && data.paymentMethod === 'pay_at_pickup' ? { recordPayment: true } : {}),
        ...(to === 'cancelled' ? { reason } : {}),
        ...extra,
      });
      let shown: OrderStatus = to;
      if (to === 'accepted') {
        await postStatus('preparing', 'accepted');
        shown = 'preparing';
        await sendKitchenPrint('manual');
      }
      notify({ tone: 'ok', text: text('Order updated', 'تم تحديث الطلب') + ` · ${staffLabels[staffStatus(shown)][lang]}` });
      setCancel(false);
      setTenderOpen(false);
      if (closeOnTerminal && (terminalStatuses as readonly string[]).includes(to)) { onBack(); onChange(); return; }
      await load(); onChange();
    } catch (e) { setError(e instanceof Error && e.message === 'STALE_STATUS' ? 'STALE_STATUS' : e instanceof Error && e.message === 'PRINT_FAILED' ? 'PRINT_FAILED' : 'UPDATE_FAILED'); await load(); }
    finally { setBusy(false); }
  }

  async function collectWithTender(tenders?: TenderLine[]) {
    const lines = tenders ?? tendersForCollect();
    if (!lines) {
      setError('UPDATE_FAILED');
      return;
    }
    await change('completed', { tenders: lines });
  }

  async function collectAll(kind: 'cash' | 'card') {
    if (!data) return;
    setTenderMode(kind);
    await collectWithTender(singleTender(kind, data.totalMinor));
  }

  async function settleCashBack(adjustmentId: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/orders/${id}/adjustments/${adjustmentId}/settle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!response.ok) throw new Error('UPDATE_FAILED');
      notify({ tone: 'ok', text: text('Cash return recorded', 'تم تسجيل إرجاع النقد') });
      await load(); onChange();
    } catch { setError('UPDATE_FAILED'); }
    finally { setBusy(false); }
  }
  const branch = branches.find(b => b.slug === data?.branchId);
  const storedCoupon = data?.snapshot.coupon;
  const coupon = storedCoupon && storedCoupon.code && Number.isSafeInteger(storedCoupon.discountMinor) && storedCoupon.discountMinor > 0 ? storedCoupon : null;
  const subtotalMinor = data && coupon ? orderTotals({ lines: data.currentLines, totalMinor: data.totalMinor }).subtotalMinor : null;
  const times=data?stageTimes(data,now):null;
  const timingBits=times?([[text('Accept','قبول'),times.acceptance],[text('Prep','تحضير'),times.preparation],[text('Collect','استلام'),times.collection]] as const).filter(([,value])=>value!=null).map(([label,value])=>`${label} ${value}${text('m','د')}`):[];
  const timingLine=timingBits.join(' · ');
  const branchName=branch?(lang==='ar'?branch.nameAr:branch.name):'';
  return <section className="staff-order-detail" aria-busy={busy}>
    <button type="button" className="ops-detail-back" onClick={onBack}>← {text('Back to orders', 'العودة إلى الطلبات')}</button>
    {error && <p role="alert" className="staff-error">{error === 'STALE_STATUS' ? text('Another team member updated this order. The latest status is shown.', 'حدّث موظف آخر هذا الطلب. تظهر الحالة الأحدث الآن.') : error === 'LOAD_FAILED' ? text('Unable to load order. Please retry.', 'تعذّر تحميل الطلب. يرجى المحاولة مجدداً.') : error === 'PRINT_FAILED' ? text('Unable to print this ticket. Please retry.', 'تعذّرت طباعة التذكرة. يرجى المحاولة مجدداً.') : text('Unable to update this order. Please retry.', 'تعذّر تحديث الطلب. يرجى المحاولة مجدداً.')}</p>}
    {data && <>
      <header className="ops-detail-heading">
        <div className="ops-detail-title">
          <h2 dir="ltr">#{formatOrderNumber(data.orderNumber)} · {data.currentLines.reduce((n,l)=>n+l.quantity,0)} {text('item(s)','صنف')} · {data.orderSurface==='staff'?text('Staff POS','نقطة بيع الموظفين'):text('Car collection','استلام بالسيارة')}</h2>
          <StatusBadge status={staffStatus(data.status)}>{staffLabels[staffStatus(data.status)][lang]}</StatusBadge>
        </div>
        <p className="ops-detail-sub">{[branchName,timingLine].filter(Boolean).join(' · ')}</p>
        {data.arrivedAt && <p className="ops-arrived-banner" role="status">{text('Customer has arrived for pickup', 'وصل العميل للاستلام')}</p>}
      </header>
      <section className="kitchen-actions-band ops-detail-actions-top" aria-label={text('Actions', 'إجراءات')}>
        <div className="staff-action-bar">
          <div className="staff-action-main">
            {(data.status === 'placed' || data.status === 'paid') && (
              <button type="button" className="primary accept-order staff-action-slot" disabled={busy} onClick={() => void change('accepted')}>{text('Accept order', 'قبول الطلب')}</button>
            )}
            {data.status === 'preparing' && (
              <button type="button" className="primary accept-order staff-action-slot" disabled={busy} onClick={() => void change('ready')}>{text('Mark ready', 'جاهز')}</button>
            )}
            {data.tendersRequired && !tenderOpen && (
              <button type="button" className="primary accept-order staff-action-slot" disabled={busy} onClick={() => { setTenderOpen(true); setTenderMode('cash'); setCashMajor(''); }}>
                {text('Collect payment', 'تحصيل الدفع')} · <span dir="ltr">{formatMinor(data.totalMinor, lang)}</span>
              </button>
            )}
            {!data.tendersRequired && data.status === 'ready' && data.paymentMethod === 'pay_at_pickup' && (
              <button type="button" className="primary accept-order staff-action-slot" disabled={busy} onClick={() => void change('completed')}>{text('Mark paid & collected', 'تأكيد الدفع والاستلام')}</button>
            )}
            {!data.tendersRequired && data.status === 'ready' && Boolean(data.paidAt) && (
              <button type="button" className="primary accept-order staff-action-slot" disabled={busy} onClick={() => void change('completed')}>{staffLabels.collected[lang]}</button>
            )}
            {tenderOpen && data.tendersRequired && (
              <div className="staff-tender-panel" role="group" aria-label={text('Collect payment', 'تحصيل الدفع')}>
                <div className="staff-tender-due">
                  <span>{text('Amount due', 'المبلغ المستحق')}</span>
                  <strong dir="ltr">{formatMinor(data.totalMinor, lang)}</strong>
                </div>
                {data.totalMinor === 0 ? (
                  <div className="staff-tender-modes">
                    <button type="button" className="staff-tender-pay" disabled={busy} onClick={() => void collectWithTender([])}>{text('Collect · nothing due', 'تحصيل · لا مستحق')}</button>
                    <button type="button" disabled={busy} onClick={() => setTenderOpen(false)}>{text('Back', 'رجوع')}</button>
                  </div>
                ) : tenderMode !== 'split' ? (
                  <div className="staff-tender-modes">
                    <button type="button" className="staff-tender-pay" disabled={busy} onClick={() => void collectAll('cash')}>{text('Cash', 'نقد')}</button>
                    <button type="button" className="staff-tender-pay" disabled={busy} onClick={() => void collectAll('card')}>{text('Card', 'بطاقة')}</button>
                    <button type="button" disabled={busy} onClick={() => { setTenderMode('split'); setCashMajor(''); }}>{text('Split', 'تقسيم')}</button>
                    <button type="button" disabled={busy} onClick={() => setTenderOpen(false)}>{text('Back', 'رجوع')}</button>
                  </div>
                ) : (
                  <div className="staff-tender-split">
                    <label>{text('Cash portion', 'جزء النقد')}
                      <input
                        inputMode="decimal"
                        value={cashMajor}
                        disabled={busy}
                        autoFocus
                        placeholder={(data.totalMinor / 100).toFixed(2)}
                        aria-invalid={Boolean(splitHint)}
                        aria-describedby={splitHint ? 'staff-tender-split-hint' : 'staff-tender-split-card'}
                        onChange={(e) => setCashMajor(sanitizeCashMajorInput(e.target.value))}
                      />
                    </label>
                    {splitHint
                      ? <p id="staff-tender-split-hint" className="staff-tender-split-error" role="alert">{splitHint}</p>
                      : <p id="staff-tender-split-card" className="staff-tender-split-card" dir="ltr">
                          {text('Card', 'بطاقة')}{' '}
                          {formatMinor(splitParse?.ok ? splitParse.cardMinor : data.totalMinor, lang)}
                        </p>}
                    <div className="staff-tender-modes">
                      <button type="button" className="staff-tender-pay" disabled={busy || !splitParse?.ok} onClick={() => void collectWithTender()}>{text('Confirm', 'تأكيد')}</button>
                      <button type="button" disabled={busy} onClick={() => { setTenderMode('cash'); setCashMajor(''); }}>{text('Back', 'رجوع')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="staff-action-tools">
            <button type="button" className="ticket-print" disabled={busy} onClick={() => void printNow(data.printCount > 0 ? 'reprint' : 'manual')}>{text(data.printCount > 0 ? 'Reprint ticket' : 'Print ticket', data.printCount > 0 ? 'إعادة طباعة التذكرة' : 'طباعة التذكرة')}</button>
            {role === 'admin' && allowedTransitions(data.status, data.paidAt).includes('refunded') && <button type="button" disabled={busy} onClick={() => void change('refunded')}>{text('Refund', 'استرداد')}</button>}
            {allowedTransitions(data.status, data.paidAt).includes('cancelled') && <button type="button" className="danger" disabled={busy} onClick={() => setCancel(true)}>{text('Cancel', 'إلغاء')}</button>}
          </div>
        </div>
      </section>
      <article className="kitchen-sheet">
        <section className="kitchen-who staff-detail-head">
          <h3>{text('Collection details', 'بيانات الاستلام')}</h3>
          <dl className="kitchen-facts">
            {data.orderSurface !== 'staff' && <div><dt>{text('Name', 'الاسم')}</dt><dd>{data.customer.name || '—'}</dd></div>}
            {data.orderSurface !== 'staff' && <div><dt>{text('Phone', 'الجوال')}</dt><dd dir="ltr">{nationalPhone(data.customer.phone).length===8?<a className="ops-customer-call" href={`tel:+974${nationalPhone(data.customer.phone)}`}>{spacedPhone(data.customer.phone)}</a>:spacedPhone(data.customer.phone)||'—'}</dd></div>}
            <div><dt>{text('Plate', 'اللوحة')}</dt><dd dir="ltr">{data.customer.plate}</dd></div>
            <div><dt>{text('Payment', 'الدفع')}</dt><dd><span className={`ops-pay-badge ${
              !data.paidAt ? 'is-pickup'
                : data.paymentMethod === 'cash' ? 'is-cash'
                : data.paymentMethod === 'card' ? 'is-card'
                : data.paymentMethod === 'split' ? 'is-split'
                : 'is-paid'
            }`}>{
              data.paidAt
                ? data.paymentMethod === 'cash' ? text('Cash collected', 'تم نقداً')
                  : data.paymentMethod === 'card' ? text('Card collected', 'تم بالبطاقة')
                  : data.paymentMethod === 'split' ? text('Split collected', 'تم مقسّماً')
                  : text('Paid', 'مدفوع')
                : data.tendersRequired ? text('Pay at counter', 'الدفع عند الكاونتر')
                : data.paymentMethod === 'pay_at_pickup' ? text('Pay at pickup', 'الدفع عند الاستلام')
                : text('Unpaid', 'غير مدفوع')
            }</span>{data.tenders.length>0&&<small>{data.tenders.map(t=>`${t.kind==='cash'?text('Cash','نقد'):text('Card','بطاقة')} ${formatMinor(t.amountMinor,lang)}`).join(' · ')}</small>}</dd></div>
            {data.createdBy && <div><dt>{text('Created by', 'أنشأه')}</dt><dd>{data.createdBy}</dd></div>}
            {data.orderSurface !== 'staff' && (data.customer.colour || data.customer.brand || data.customer.car) && <div className="ops-fact-vehicle"><dt>{text('Vehicle', 'السيارة')}</dt><dd><span className="ops-detail-car"><CarBrandLogo brand={findCarBrand(data.brandId??'')}/><span>{[data.customer.colour,carBrandName(data.brandId??'',lang)||data.customer.brand,data.customer.car].filter(Boolean).join(' ')}</span></span></dd></div>}
            {data.customer.instructions && <div className="ops-fact-wide"><dt>{text('Instructions', 'التعليمات')}</dt><dd>{data.customer.instructions}</dd></div>}
          </dl>
        </section>
        <section className="kitchen-order">
          <h3>{text('Order details', 'تفاصيل الطلب')}</h3>
          <ul className="kitchen-items">{data.currentLines.map(line => {
            const choices = lineChoices(line, menu, lang, t);
            const dish=menu.dishes.find(d=>d.id===line.dishId);
            return <li key={line.id} data-voided={line.voided || undefined}>
              {dish&&<Image className="ops-detail-food" src={imageFor(dish,line.selection)} alt="" width={54} height={54} unoptimized/>}
              <p className="kitchen-item"><span>{line.quantity} × {lang==='ar'?line.nameAr||line.name:line.name}</span><span dir="ltr">{line.compliment ? text('Comp', 'هدية') : formatMinor(line.unitMinor * line.quantity, lang)}</span></p>
              {choices.length > 0 && <p className="kitchen-detail"><span>{text('Choices', 'الخيارات')}</span><span>{choices.join(', ')}</span></p>}
              {line.note && <p className="kitchen-detail"><span>{text('Note', 'ملاحظة')}</span><span>{line.note}</span></p>}
            </li>;
          })}</ul>
          {coupon && subtotalMinor != null && <>
            <p className="kitchen-item"><span>{text('Subtotal', 'المجموع الفرعي')}</span><span dir="ltr">{formatMinor(subtotalMinor, lang)}</span></p>
            <p className="kitchen-item"><span>{text('Coupon', 'قسيمة')} <span dir="ltr">{coupon.code}</span></span><span dir="ltr">{formatMinor(-coupon.discountMinor, lang)}</span></p>
          </>}
          <p className="kitchen-total"><span>{text('Total', 'الإجمالي')}</span><strong dir="ltr">{formatMinor(data.totalMinor, lang)}</strong></p>
          {data.owedBackMinor > 0 && <p className="kitchen-item"><span>{text('Owed back', 'المبلغ المسترد')}</span><span dir="ltr">{formatMinor(data.owedBackMinor, lang)}</span></p>}
          {data.adjustments.some((row) => !row.settledAt) && <ul className="staff-adjustments">{data.adjustments.filter((row) => !row.settledAt).map((row) => (
            <li key={row.id}>
              <span dir="ltr">{formatMinor(row.amountMinor, lang)}</span>
              <button type="button" disabled={busy} onClick={() => void settleCashBack(row.id)}>{text('Cash returned', 'تم إرجاع النقد')}</button>
            </li>
          ))}</ul>}
        </section>
        <section className="ops-detail-secondary">
          <details className="order-edit-fold"><summary>{text('Edit order', 'تعديل الطلب')}</summary>
            <OrderEditPanel id={id} data={data} role={role} menu={menu} onSaved={async () => { await load(); onChange(); }} onReprint={() => void printNow(data.printCount > 0 ? 'reprint' : 'manual')} />
          </details>
          {cancel && <form className="admin-confirm" onSubmit={e => { e.preventDefault(); void change('cancelled'); }}>
            <label>{text('Cancellation reason', 'سبب الإلغاء')}<select value={reason} onChange={e => setReason(e.target.value as typeof reason)}>{cancellationReasons.map(r => <option key={r} value={r}>{reasons[r]}</option>)}</select></label>
            <div className="admin-actions"><button className="danger" disabled={busy} type="submit">{text('Confirm cancellation', 'تأكيد الإلغاء')}</button><button type="button" onClick={() => setCancel(false)}>{t.close}</button></div>
          </form>}
          <details className="staff-history"><summary>{text('Order history', 'سجل الطلب')}</summary><ol>{data.history.map((h,i) => <li key={i}><time>{formatQatarDateTime(h.at)}</time> · {staffLabels[staffStatus(h.to)][lang]}{h.reason && ` · ${reasons[h.reason as keyof typeof reasons] || h.reason}`}</li>)}</ol></details>
        </section>
      </article>
    </>}
  </section>;
}
