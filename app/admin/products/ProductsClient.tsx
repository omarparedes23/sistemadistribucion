"use client";

import { useState, useActionState } from "react";
import {
  createProduct,
  updateProduct,
  toggleProductActive,
  type ProductState,
} from "@/lib/actions/products";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type Product = {
  id: string;
  sku: string;
  name: string;
  brand_id: string;
  unit_of_measure: string;
  weight_kg: number | null;
  volume_m3: number | null;
  active: boolean;
  re_brands: { name: string } | null;
};

type Brand = { id: string; name: string };

export function ProductsClient({
  initialProducts,
  brands,
}: {
  initialProducts: Product[];
  brands: Brand[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    ProductState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateProduct(null, formData)
      : await createProduct(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    ProductState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleProductActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingProduct = initialProducts.find((p) => p.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="sku" className="text-sm font-medium text-gray-700">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              defaultValue={editingProduct?.sku ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="PROD-001"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={editingProduct?.name ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Arroz Extra"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="brand_id" className="text-sm font-medium text-gray-700">
              Marca <span className="text-red-500">*</span>
            </label>
            <select
              id="brand_id"
              name="brand_id"
              defaultValue={editingProduct?.brand_id ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona una marca</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="unit_of_measure" className="text-sm font-medium text-gray-700">
              Unidad de medida <span className="text-red-500">*</span>
            </label>
            <input
              id="unit_of_measure"
              name="unit_of_measure"
              type="text"
              defaultValue={editingProduct?.unit_of_measure ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="kg, unidad, caja"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="weight_kg" className="text-sm font-medium text-gray-700">
              Peso (kg)
            </label>
            <input
              id="weight_kg"
              name="weight_kg"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editingProduct?.weight_kg ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="volume_m3" className="text-sm font-medium text-gray-700">
              Volumen (m³)
            </label>
            <input
              id="volume_m3"
              name="volume_m3"
              type="number"
              step="0.0001"
              min="0"
              defaultValue={editingProduct?.volume_m3 ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.0000"
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
              ? "Actualizar producto"
              : "Crear producto"}
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
          { header: "SKU" },
          { header: "Nombre" },
          { header: "Marca" },
          { header: "UOM" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Lista de productos"
      >
        {initialProducts.map((prod) => (
          <EntityTableRow key={prod.id}>
            <EntityTableCell className="font-mono text-xs text-gray-500">
              {prod.sku}
            </EntityTableCell>
            <EntityTableCell className="font-medium text-gray-900">
              {prod.name}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {prod.re_brands?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {prod.unit_of_measure}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  prod.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {prod.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(prod.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={prod.id} />
                  <input type="hidden" name="active" value={String(prod.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      prod.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={prod.active ? "Desactivar" : "Activar"}
                  >
                    {prod.active ? (
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
        {initialProducts.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={6} className="py-8 text-center text-gray-500">
              No hay productos registrados.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
