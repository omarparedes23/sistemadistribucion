"use client";

import { useState, useActionState } from "react";
import {
  createDiscountRule,
  updateDiscountRule,
  toggleDiscountRuleActive,
  type DiscountRuleState,
} from "@/lib/actions/pricing";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type DiscountRule = {
  id: string;
  price_list_id: string;
  product_id: string;
  min_quantity: number;
  discount_pct: number;
  valid_from: string;
  valid_until: string | null;
  active: boolean;
  re_products: { name: string; sku: string } | null;
  re_price_lists: { name: string } | null;
};

type Product = { id: string; name: string; sku: string };
type PriceList = { id: string; name: string };

export function DescuentosClient({
  initialRules,
  products,
  priceLists,
}: {
  initialRules: DiscountRule[];
  products: Product[];
  priceLists: PriceList[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    DiscountRuleState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateDiscountRule(null, formData)
      : await createDiscountRule(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    DiscountRuleState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleDiscountRuleActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingRule = initialRules.find((r) => r.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Reglas de Descuento
        </h1>
      </div>

      <form
        key={editingId ?? "new"}
        action={formAction}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="id" value={editingId ?? ""} />

        {formState?.success === false && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formState.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="price_list_id" className="text-sm font-medium text-gray-700">
              Lista de precios <span className="text-red-500">*</span>
            </label>
            <select
              id="price_list_id"
              name="price_list_id"
              defaultValue={editingRule?.price_list_id ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona lista</option>
              {priceLists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="product_id" className="text-sm font-medium text-gray-700">
              Producto <span className="text-red-500">*</span>
            </label>
            <select
              id="product_id"
              name="product_id"
              defaultValue={editingRule?.product_id ?? ""}
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
            <label htmlFor="min_quantity" className="text-sm font-medium text-gray-700">
              Cantidad mínima <span className="text-red-500">*</span>
            </label>
            <input
              id="min_quantity"
              name="min_quantity"
              type="number"
              step="0.0001"
              min="0.0001"
              defaultValue={editingRule?.min_quantity ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.0000"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="discount_pct" className="text-sm font-medium text-gray-700">
              Descuento (%) <span className="text-red-500">*</span>
            </label>
            <input
              id="discount_pct"
              name="discount_pct"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              defaultValue={editingRule?.discount_pct ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="valid_from" className="text-sm font-medium text-gray-700">
              Vigente desde <span className="text-red-500">*</span>
            </label>
            <input
              id="valid_from"
              name="valid_from"
              type="date"
              defaultValue={editingRule?.valid_from ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="valid_until" className="text-sm font-medium text-gray-700">
              Vigente hasta
            </label>
            <input
              id="valid_until"
              name="valid_until"
              type="date"
              defaultValue={editingRule?.valid_until ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
              ? "Actualizar regla"
              : "Crear regla"}
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
          { header: "Lista de precios" },
          { header: "Producto" },
          { header: "Cantidad mínima", className: "text-right" },
          { header: "Descuento (%)" },
          { header: "Vigencia" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Reglas de descuento"
      >
        {initialRules.map((rule) => (
          <EntityTableRow key={rule.id}>
            <EntityTableCell className="text-gray-500">
              {rule.re_price_lists?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="font-medium text-gray-900">
              <div>{rule.re_products?.name ?? "—"}</div>
              <div className="font-mono text-xs text-gray-500">
                {rule.re_products?.sku ?? "—"}
              </div>
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(rule.min_quantity).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {rule.discount_pct}%
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              <div className="text-xs">
                <div>Desde: {rule.valid_from}</div>
                {rule.valid_until && <div>Hasta: {rule.valid_until}</div>}
              </div>
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  rule.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {rule.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(rule.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={rule.id} />
                  <input type="hidden" name="active" value={String(rule.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      rule.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={rule.active ? "Desactivar" : "Activar"}
                  >
                    {rule.active ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {initialRules.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={7} className="py-8 text-center text-gray-500">
              No hay reglas de descuento registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
