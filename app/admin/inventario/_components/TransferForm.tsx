"use client";

import { useState, useActionState } from "react";
import { createTransfer, type TransferState } from "@/lib/actions/transfers";
import { Plus } from "lucide-react";

type Branch = { id: string; name: string };
type Warehouse = { id: string; name: string; branch_id: string };
type Product = { id: string; name: string; sku: string };

export function TransferForm({
  branches,
  warehouses,
  products,
}: {
  branches: Branch[];
  warehouses: Warehouse[];
  products: Product[];
}) {
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch] = useState("");

  const fromWarehouses = warehouses.filter(
    (w) => w.branch_id === fromBranch
  );
  const toWarehouses = warehouses.filter((w) => w.branch_id === toBranch);

  const [formState, formAction, isPending] = useActionState<
    TransferState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await createTransfer(null, formData);
    if (result.success) {
      setFromBranch("");
      setToBranch("");
      window.location.reload();
    }
    return result;
  }, null);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Nueva transferencia
      </h2>

      {formState?.success === false && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {formState.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label
            htmlFor="from_branch_id"
            className="text-sm font-medium text-gray-700"
          >
            Sucursal origen <span className="text-red-500">*</span>
          </label>
          <select
            id="from_branch_id"
            name="from_branch_id"
            value={fromBranch}
            onChange={(e) => setFromBranch(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Selecciona sucursal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="from_warehouse_id"
            className="text-sm font-medium text-gray-700"
          >
            Almacén origen <span className="text-red-500">*</span>
          </label>
          <select
            id="from_warehouse_id"
            name="from_warehouse_id"
            required
            disabled={!fromBranch}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Selecciona almacén</option>
            {fromWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="to_branch_id"
            className="text-sm font-medium text-gray-700"
          >
            Sucursal destino <span className="text-red-500">*</span>
          </label>
          <select
            id="to_branch_id"
            name="to_branch_id"
            value={toBranch}
            onChange={(e) => setToBranch(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Selecciona sucursal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="to_warehouse_id"
            className="text-sm font-medium text-gray-700"
          >
            Almacén destino <span className="text-red-500">*</span>
          </label>
          <select
            id="to_warehouse_id"
            name="to_warehouse_id"
            required
            disabled={!toBranch}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Selecciona almacén</option>
            {toWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
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
            <option value="">Selecciona producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
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

        <div className="space-y-1.5 sm:col-span-2">
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
            placeholder="Observaciones de la transferencia"
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
          {isPending ? "Guardando..." : "Crear transferencia"}
        </button>
      </div>
    </form>
  );
}
