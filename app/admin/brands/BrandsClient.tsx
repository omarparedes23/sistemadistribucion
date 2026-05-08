"use client";

import { useState, useActionState } from "react";
import {
  createBrand,
  updateBrand,
  toggleBrandActive,
  type BrandState,
} from "@/lib/actions/brands";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type Brand = {
  id: string;
  name: string;
  category_id: string;
  active: boolean;
  re_categories: { name: string } | null;
};

type Category = { id: string; name: string };

export function BrandsClient({
  initialBrands,
  categories,
}: {
  initialBrands: Brand[];
  categories: Category[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    BrandState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateBrand(null, formData)
      : await createBrand(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    BrandState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleBrandActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingBrand = initialBrands.find((b) => b.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Marcas</h1>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={editingBrand?.name ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ej. Costeño"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="category_id" className="text-sm font-medium text-gray-700">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              id="category_id"
              name="category_id"
              defaultValue={editingBrand?.category_id ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
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
              ? "Actualizar marca"
              : "Crear marca"}
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
          { header: "Nombre" },
          { header: "Categoría" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Lista de marcas"
      >
        {initialBrands.map((brand) => (
          <EntityTableRow key={brand.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {brand.name}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {brand.re_categories?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  brand.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {brand.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(brand.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={brand.id} />
                  <input type="hidden" name="active" value={String(brand.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      brand.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={brand.active ? "Desactivar" : "Activar"}
                  >
                    {brand.active ? (
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
        {initialBrands.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={4} className="py-8 text-center text-gray-500">
              No hay marcas registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
