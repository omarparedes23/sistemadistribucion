"use client";

import { useState, useCallback, useActionState } from "react";
import { createOrderForm, submitToPendingForm, type OrderState } from "@/lib/actions/orders";
import { resolvePrice } from "@/lib/actions/price-resolution";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Plus, Trash2, Tag } from "lucide-react";

type Customer = { id: string; legal_name: string; trade_name: string | null };
type Route = { id: string; name: string };
type Product = { id: string; name: string; sku: string; unit_of_measure: string };
type Address = { id: string; address_line: string; district: string };
type ItemRow = {
  tempId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  priceListId: string | null;
  resolving: boolean;
};

export function NuevoPedidoClient({
  branchId,
  sellerId,
  customers,
  routes,
  products,
}: {
  branchId: string;
  sellerId: string;
  customers: Customer[];
  routes: Route[];
  products: Product[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [formState, formAction, isPending] = useActionState<OrderState | null, FormData>(
    async (_prev, formData) => {
      const result = await createOrderForm(null, formData);
      if (result.success && result.orderId) {
        const fd = new FormData();
        fd.append("id", result.orderId);
        const sr = await submitToPendingForm(null, fd);
        if (sr.success) window.location.href = "/vendedor/pedidos";
        return sr;
      }
      return result;
    },
    null
  );

  const loadAddresses = useCallback(async (cid: string) => {
    if (!cid) { setAddresses([]); return; }
    const sb = createBrowserClient();
    const { data } = await sb.from("re_customer_addresses").select("id, address_line, district").eq("customer_id", cid).order("is_primary", { ascending: false });
    setAddresses(data ?? []);
  }, []);

  const resolveRow = useCallback(async (row: ItemRow, qty: number, pid: string) => {
    if (!customerId || !pid || qty <= 0) return row;
    const pr = await resolvePrice(customerId, pid, branchId);
    if (!pr.success) return { ...row, resolving: false };
    const sb = createBrowserClient();
    const today = new Date().toISOString().split("T")[0];
    const { data: rules } = await sb.from("re_discount_rules")
      .select("min_quantity, discount_pct")
      .eq("price_list_id", pr.price_list_id)
      .eq("product_id", pid)
      .eq("active", true)
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`);
    let discountPct = 0;
    if (rules && rules.length > 0) {
      const app = rules.find((r) => qty >= r.min_quantity);
      if (app) discountPct = app.discount_pct;
    }
    const lineTotal = qty * pr.unit_price * (1 - discountPct / 100);
    return { ...row, quantity: qty, productId: pid, unitPrice: pr.unit_price, discountPct, lineTotal, priceListId: pr.price_list_id, resolving: false };
  }, [customerId, branchId]);

  const addItem = () => {
    setItems((p) => [...p, { tempId: crypto.randomUUID(), productId: "", quantity: 1, unitPrice: 0, discountPct: 0, lineTotal: 0, priceListId: null, resolving: false }]);
  };
  const removeItem = (tid: string) => setItems((p) => p.filter((i) => i.tempId !== tid));

  const updateItem = async (tid: string, changes: Partial<ItemRow>) => {
    setItems((p) => p.map((i) => (i.tempId === tid ? { ...i, ...changes, resolving: true } : i)));
    const row = items.find((i) => i.tempId === tid);
    if (!row) return;
    const updated = await resolveRow(row, changes.quantity ?? row.quantity, changes.productId ?? row.productId);
    setItems((p) => p.map((i) => (i.tempId === tid ? updated : i)));
  };

  const grandTotal = items.reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo pedido</h1>
      </div>
      <form action={formAction} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="branch_id" value={branchId} />
        <input type="hidden" name="seller_id" value={sellerId} />
        <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ product_id: i.productId, quantity: i.quantity, unit_price: i.unitPrice, discount_pct: i.discountPct, line_total: i.lineTotal })))} />
        {formState?.success === false && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formState.error}</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Cliente <span className="text-red-500">*</span></label>
            <select name="customer_id" required value={customerId} onChange={(e) => { setCustomerId(e.target.value); loadAddresses(e.target.value); }} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
              <option value="">Selecciona un cliente</option>
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.trade_name ?? c.legal_name}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Dirección de entrega <span className="text-red-500">*</span></label>
            <select name="delivery_address_id" required disabled={addresses.length === 0} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50">
              <option value="">{addresses.length === 0 ? "Selecciona un cliente primero" : "Selecciona una dirección"}</option>
              {addresses.map((a) => (<option key={a.id} value={a.id}>{a.address_line}, {a.district}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Ruta de venta <span className="text-red-500">*</span></label>
            <select name="sales_route_id" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
              <option value="">Selecciona una ruta</option>
              {routes.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <input name="notes" type="text" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Opcional" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Ítems</h2>
            <button type="button" onClick={addItem} disabled={!customerId} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" /> Agregar ítem
            </button>
          </div>
          {items.length === 0 && <p className="text-sm text-gray-500">Agrega al menos un ítem al pedido.</p>}
          {items.map((item) => (
            <div key={item.tempId} className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-medium text-gray-700">Producto</label>
                <select value={item.productId} onChange={(e) => updateItem(item.tempId, { productId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                  <option value="">Selecciona</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad</label>
                <input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={(e) => updateItem(item.tempId, { quantity: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">P. unitario</label>
                <div className="px-1 py-2 text-sm text-gray-700">{item.unitPrice > 0 ? `S/ ${item.unitPrice.toFixed(2)}` : "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">Desc.</label>
                <div className="px-1 py-2 text-sm">
                  {item.discountPct > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"><Tag className="h-3 w-3" />{item.discountPct.toFixed(0)}%</span>
                  ) : (<span className="text-gray-400">—</span>)}
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs font-medium text-gray-700">Total</label>
                <div className="px-1 py-2 text-sm font-medium text-gray-900">{item.lineTotal > 0 ? `S/ ${item.lineTotal.toFixed(2)}` : "—"}</div>
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <button type="button" onClick={() => removeItem(item.tempId)} className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600" title="Eliminar ítem"><Trash2 className="h-4 w-4" /></button>
              </div>
              {item.resolving && <div className="sm:col-span-12 text-xs text-gray-400">Resolviendo precio…</div>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-lg font-semibold text-gray-900">Total: S/ {grandTotal.toFixed(2)}</div>
          <button type="submit" disabled={isPending || items.length === 0 || !customerId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
            {isPending ? "Guardando…" : "Crear y enviar pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}
