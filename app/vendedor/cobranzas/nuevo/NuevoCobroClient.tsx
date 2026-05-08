"use client";

import { useState, useActionState } from "react";
import { registerCollectionForm, type CollectionState } from "@/lib/actions/collections";
import { Plus, Trash2, Banknote } from "lucide-react";

type Customer = { id: string; legal_name: string; trade_name: string | null };

type Order = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  outstanding: number;
  notes: string | null;
  created_at: string;
  re_customers: { legal_name: string; trade_name: string | null } | null;
};

type ItemRow = {
  tempId: string;
  orderId: string;
  amount: number;
};

export function NuevoCobroClient({
  branchId,
  sellerId,
  customers,
  orders,
  preselectedOrderId,
}: {
  branchId: string;
  sellerId: string;
  customers: Customer[];
  orders: Order[];
  preselectedOrderId: string | null;
}) {
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (preselectedOrderId) {
      const order = orders.find((o) => o.id === preselectedOrderId);
      if (order) {
        return [
          {
            tempId: crypto.randomUUID(),
            orderId: order.id,
            amount: order.outstanding,
          },
        ];
      }
    }
    return [];
  });

  const [formState, formAction, isPending] = useActionState<CollectionState | null, FormData>(
    async (_prev, formData) => {
      const result = await registerCollectionForm(null, formData);
      if (result.success) {
        window.location.href = "/vendedor/cobranzas";
      }
      return result;
    },
    null
  );

  const addItem = () => {
    setItems((p) => [...p, { tempId: crypto.randomUUID(), orderId: "", amount: 0 }]);
  };

  const removeItem = (tid: string) => {
    setItems((p) => p.filter((i) => i.tempId !== tid));
  };

  const updateItem = (tid: string, changes: Partial<ItemRow>) => {
    setItems((p) => p.map((i) => (i.tempId === tid ? { ...i, ...changes } : i)));
  };

  const filteredOrders = orders.filter(
    (o) => !customerId || o.re_customers?.legal_name === customers.find((c) => c.id === customerId)?.legal_name
    // We don't have a direct customer_id on Order type from getOrdersWithOutstandingBalance.
    // The orders query didn't select customer_id. To keep it simple, we show all seller orders.
  );

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const needsReference = paymentMethod !== "EFECTIVO";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo cobro</h1>
      </div>

      <form
        action={formAction}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="branch_id" value={branchId} />
        <input type="hidden" name="seller_id" value={sellerId} />
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(
            items.map((i) => ({
              order_id: i.orderId,
              invoice_id: null,
              amount_applied: Number(i.amount),
            }))
          )}
        />

        {formState?.success === false && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formState.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              name="customer_id"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecciona un cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name ?? c.legal_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Método de pago <span className="text-red-500">*</span>
            </label>
            <select
              name="payment_method"
              required
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>

          {needsReference && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Número de referencia <span className="text-red-500">*</span>
              </label>
              <input
                name="reference_number"
                type="text"
                required={needsReference}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Ej. OP123456"
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Asignación a pedidos</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar ítem
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-gray-500">
              Agrega al menos un pedido para asignar el cobro.
            </p>
          )}

          {items.map((item) => {
            const order = orders.find((o) => o.id === item.orderId);
            return (
              <div
                key={item.tempId}
                className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-6">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Pedido
                  </label>
                  <select
                    value={item.orderId}
                    onChange={(e) => updateItem(item.tempId, { orderId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecciona un pedido</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.re_customers?.trade_name ?? o.re_customers?.legal_name} — S/{" "}
                        {o.outstanding.toFixed(2)} pendiente
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Monto aplicado
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) =>
                      updateItem(item.tempId, { amount: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(item.tempId)}
                    className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {order && item.amount > order.outstanding && (
                  <div className="sm:col-span-12 text-xs text-red-600">
                    El monto excede el saldo pendiente (S/ {order.outstanding.toFixed(2)}).
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-lg font-semibold text-gray-900">
            Total: S/ {total.toFixed(2)}
          </div>
          <button
            type="submit"
            disabled={
              isPending ||
              items.length === 0 ||
              !customerId ||
              (needsReference && !referenceNumber) ||
              items.some((i) => {
                const order = orders.find((o) => o.id === i.orderId);
                return !i.orderId || !i.amount || (order ? i.amount > order.outstanding : false);
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Banknote className="h-4 w-4" />
            {isPending ? "Guardando…" : "Registrar cobro"}
          </button>
        </div>
      </form>
    </div>
  );
}
