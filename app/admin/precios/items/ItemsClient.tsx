"use client";

import { useState, useActionState } from "react";
import {
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
  type PriceListItemState,
} from "@/lib/actions/pricing";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

type PriceListItem = {
  id: string;
  price_list_id: string;
  product_id: string;
  unit_price: number;
  currency: string;
  discount_pct: number | null;
  re_products: { name: string; sku: string } | null;
};

type Product = { id: string; name: string; sku: string };

export function ItemsClient({
  initialItems,
  products,
  listId,
  listName,
}: {
  initialItems: PriceListItem[];
  products: Product[];
  listId: string;
  listName: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    PriceListItemState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updatePriceListItem(null, formData)
      : await createPriceListItem(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const [, deleteAction, isDeletePending] = useActionState<
    PriceListItemState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await deletePriceListItem(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const editingItem = initialItems.find((i) => i.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/precios"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a listas
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Ítems de lista: {listName}
        </h1>
      </div>

      <form
        key={editingId ?? "new"}
        action={formAction}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="id" value={editingId ?? ""} />
        <input type="hidden" name="price_list_id" value={listId} />

        {formState?.success === false && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formState.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="product_id" className="text-sm font-medium text-gray-700">
              Producto <span className="text-red-500">*</span>
            </label>
            <select
              id="product_id"
              name="product_id"
              defaultValue={editingItem?.product_id ?? ""}
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
            <label htmlFor="unit_price" className="text-sm font-medium text-gray-700">
              Precio unitario <span className="text-red-500">*</span>
            </label>
            <input
              id="unit_price"
              name="unit_price"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={editingItem?.unit_price ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="currency" className="text-sm font-medium text-gray-700">
              Moneda
            </label>
            <input
              id="currency"
              name="currency"
              type="text"
              value="PEN"
              readOnly
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="discount_pct" className="text-sm font-medium text-gray-700">
              Descuento (%)
            </label>
            <input
              id="discount_pct"
              name="discount_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={editingItem?.discount_pct ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
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
            {isPending
              ? "Guardando..."
              : editingId
              ? "Actualizar ítem"
              : "Crear ítem"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <EntityTable
        columns={[
          { header: "Producto" },
          { header: "SKU" },
          { header: "Precio unitario", className: "text-right" },
          { header: "Moneda" },
          { header: "Descuento (%)" },
          { header: "Acciones", className: "w-32" },
        ]}
        caption="Ítems de la lista de precios"
      >
        {initialItems.map((item) => (
          <EntityTableRow key={item.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {item.re_products?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="font-mono text-xs text-gray-500">
              {item.re_products?.sku ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(item.unit_price).toFixed(2)}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {item.currency}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {item.discount_pct !== null ? `${item.discount_pct}%` : "—"}
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(item.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={deleteAction} className="inline">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    disabled={isDeletePending}
                    className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {initialItems.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={6} className="py-8 text-center text-gray-500">
              No hay ítems en esta lista de precios.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
