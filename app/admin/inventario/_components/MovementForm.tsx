"use client";

import { useState, useActionState } from "react";
import { createMovement, type MovementState } from "@/lib/actions/inventory";
import { Plus } from "lucide-react";

type Product = { id: string; name: string; sku: string };
type Warehouse = { id: string; name: string; branch_id: string };

const reasonOptions: Record<string, string[]> = {
  IN: [
    "PURCHASE",
    "TRANSFER_IN",
    "SALES_RETURN",
    "ADJUSTMENT_IN",
    "INITIAL_STOCK",
  ],
  OUT: [
    "SALE",
    "TRANSFER_OUT",
    "DAMAGE_EXPIRED",
    "DAMAGE_BROKEN",
    "DAMAGE_LOST",
    "ADJUSTMENT_OUT",
  ],
};

const reasonLabels: Record<string, string> = {
  PURCHASE: "Compra",
  TRANSFER_IN: "Transferencia entrada",
  SALES_RETURN: "Devolución venta",
  ADJUSTMENT_IN: "Ajuste entrada",
  INITIAL_STOCK: "Stock inicial",
  SALE: "Venta",
  TRANSFER_OUT: "Transferencia salida",
  DAMAGE_EXPIRED: "Daño / Vencido",
  DAMAGE_BROKEN: "Daño / Roto",
  DAMAGE_LOST: "Daño / Perdido",
  ADJUSTMENT_OUT: "Ajuste salida",
};

export function MovementForm({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [reason, setReason] = useState("");

  const [formState, formAction, isPending] = useActionState<
    MovementState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await createMovement(null, formData);
    if (result.success) {
      window.location.reload();
    }
    return result;
  }, null);

  const isOut = type === "OUT";
  const costReadOnly = isOut;

  return (
    <form
      action={formAction}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Registrar movimiento manual
      </h2>

      {formState?.success === false && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {formState.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label
            htmlFor="type"
            className="text-sm font-medium text-gray-700"
          >
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as "IN" | "OUT");
              setReason("");
            }}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="IN">Entrada</option>
            <option value="OUT">Salida</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="reason_code"
            className="text-sm font-medium text-gray-700"
          >
            Motivo <span className="text-red-500">*</span>
          </label>
          <select
            id="reason_code"
            name="reason_code"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Selecciona un motivo</option>
            {reasonOptions[type].map((code) => (
              <option key={code} value={code}>
                {reasonLabels[code]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="product_id"
            className="text-sm font-medium text-gray-700"
          >
            Producto <span className="text-red-500">*</span>
          </label>
          <select
            id="product_id"
            name="product_id"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Selecciona un producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="warehouse_id"
            className="text-sm font-medium text-gray-700"
          >
            Almacén <span className="text-red-500">*</span>
          </label>
          <select
            id="warehouse_id"
            name="warehouse_id"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Selecciona un almacén</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="quantity"
            className="text-sm font-medium text-gray-700"
          >
            Cantidad <span className="text-red-500">*</span>
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="0.0001"
            min="0.0001"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="0.0000"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="unit_cost"
            className="text-sm font-medium text-gray-700"
          >
            Costo unitario {costReadOnly ? "(automático)" : ""}
          </label>
          <input
            id="unit_cost"
            type="number"
            step="0.0001"
            min="0"
            readOnly={costReadOnly}
            {...(!costReadOnly ? { name: "unit_cost" } : {})}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 ${
              costReadOnly
                ? "border-gray-200 bg-gray-50 text-gray-500 focus:border-gray-200 focus:ring-gray-200"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            }`}
            placeholder={
              costReadOnly ? "Calculado automáticamente" : "0.0000"
            }
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="movement_date"
            className="text-sm font-medium text-gray-700"
          >
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            id="movement_date"
            name="movement_date"
            type="date"
            required
            defaultValue={new Date().toISOString().split("T")[0]}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <label
            htmlFor="notes"
            className="text-sm font-medium text-gray-700"
          >
            Notas
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="Observaciones del movimiento"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {isPending ? "Guardando..." : "Registrar movimiento"}
        </button>
      </div>
    </form>
  );
}
