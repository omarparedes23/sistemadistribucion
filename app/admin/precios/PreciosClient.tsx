"use client";

import { useState, useActionState } from "react";
import {
  createPriceList,
  updatePriceList,
  togglePriceListActive,
  type PriceListState,
} from "@/lib/actions/pricing";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type PriceList = {
  id: string;
  branch_id: string;
  name: string;
  valid_from: string;
  valid_until: string | null;
  is_default: boolean;
  active: boolean;
  re_branches: { name: string } | null;
};

type Branch = { id: string; name: string };

export function PreciosClient({
  initialPriceLists,
  branches,
}: {
  initialPriceLists: PriceList[];
  branches: Branch[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    PriceListState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updatePriceList(null, formData)
      : await createPriceList(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    PriceListState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await togglePriceListActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingList = initialPriceLists.find((p) => p.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Listas de Precios</h1>
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
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={editingList?.name ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ej. Lista Mayorista"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="branch_id" className="text-sm font-medium text-gray-700">
              Sucursal <span className="text-red-500">*</span>
            </label>
            <select
              id="branch_id"
              name="branch_id"
              defaultValue={editingList?.branch_id ?? ""}
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
            <label htmlFor="valid_from" className="text-sm font-medium text-gray-700">
              Vigente desde <span className="text-red-500">*</span>
            </label>
            <input
              id="valid_from"
              name="valid_from"
              type="date"
              defaultValue={editingList?.valid_from ?? ""}
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
              defaultValue={editingList?.valid_until ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="is_default"
                defaultChecked={editingList?.is_default ?? false}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Por defecto
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editingList?.active ?? true}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Activo
            </label>
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
              ? "Actualizar lista"
              : "Crear lista"}
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
          { header: "Sucursal" },
          { header: "Vigencia" },
          { header: "Por defecto" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Listas de precios"
      >
        {initialPriceLists.map((list) => (
          <EntityTableRow key={list.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {list.name}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {list.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              <div className="text-xs">
                <div>Desde: {list.valid_from}</div>
                {list.valid_until && <div>Hasta: {list.valid_until}</div>}
              </div>
            </EntityTableCell>
            <EntityTableCell>
              {list.is_default ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  Sí
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  list.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {list.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(list.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={list.id} />
                  <input type="hidden" name="active" value={String(list.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      list.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={list.active ? "Desactivar" : "Activar"}
                  >
                    {list.active ? (
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
        {initialPriceLists.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={6} className="py-8 text-center text-gray-500">
              No hay listas de precios registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
