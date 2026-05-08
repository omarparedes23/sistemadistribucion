"use client";

import { useState, useActionState } from "react";
import {
  createWarehouse,
  updateWarehouse,
  toggleWarehouseActive,
  type WarehouseState,
} from "@/lib/actions/warehouses";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type Warehouse = {
  id: string;
  name: string;
  branch_id: string;
  active: boolean;
  re_branches: { name: string } | null;
};

type Branch = { id: string; name: string };

export function WarehousesClient({
  initialWarehouses,
  branches,
}: {
  initialWarehouses: Warehouse[];
  branches: Branch[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    WarehouseState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateWarehouse(null, formData)
      : await createWarehouse(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    WarehouseState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleWarehouseActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingWarehouse = initialWarehouses.find((w) => w.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Almacenes</h1>
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
              defaultValue={editingWarehouse?.name ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ej. Almacén Central Lima"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="branch_id" className="text-sm font-medium text-gray-700">
              Sucursal <span className="text-red-500">*</span>
            </label>
            <select
              id="branch_id"
              name="branch_id"
              defaultValue={editingWarehouse?.branch_id ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona una sucursal</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
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
              ? "Actualizar almacén"
              : "Crear almacén"}
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
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Lista de almacenes"
      >
        {initialWarehouses.map((wh) => (
          <EntityTableRow key={wh.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {wh.name}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {wh.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  wh.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {wh.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(wh.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={wh.id} />
                  <input type="hidden" name="active" value={String(wh.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      wh.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={wh.active ? "Desactivar" : "Activar"}
                  >
                    {wh.active ? (
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
        {initialWarehouses.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={4} className="py-8 text-center text-gray-500">
              No hay almacenes registrados.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
