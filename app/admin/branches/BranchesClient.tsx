"use client";

import { useState, useActionState } from "react";
import {
  createBranch,
  updateBranch,
  toggleBranchActive,
  type BranchState,
} from "@/lib/actions/branches";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type Branch = {
  id: string;
  name: string;
  region: string;
  address: string | null;
  gre_serie: string | null;
  factura_serie: string | null;
  boleta_serie: string | null;
  active: boolean;
};

export function BranchesClient({
  initialBranches,
}: {
  initialBranches: Branch[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    BranchState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateBranch(null, formData)
      : await createBranch(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    BranchState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleBranchActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingBranch = initialBranches.find((b) => b.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
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
              defaultValue={editingBranch?.name ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ej. Lima"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="region" className="text-sm font-medium text-gray-700">
              Región <span className="text-red-500">*</span>
            </label>
            <input
              id="region"
              name="region"
              type="text"
              defaultValue={editingBranch?.region ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ej. Lima, Cajamarca"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium text-gray-700">
              Dirección
            </label>
            <input
              id="address"
              name="address"
              type="text"
              defaultValue={editingBranch?.address ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Dirección de la sucursal"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gre_serie" className="text-sm font-medium text-gray-700">
              Serie GRE
            </label>
            <input
              id="gre_serie"
              name="gre_serie"
              type="text"
              defaultValue={editingBranch?.gre_serie ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="T001"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="factura_serie" className="text-sm font-medium text-gray-700">
              Serie Factura
            </label>
            <input
              id="factura_serie"
              name="factura_serie"
              type="text"
              defaultValue={editingBranch?.factura_serie ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="F001"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="boleta_serie" className="text-sm font-medium text-gray-700">
              Serie Boleta
            </label>
            <input
              id="boleta_serie"
              name="boleta_serie"
              type="text"
              defaultValue={editingBranch?.boleta_serie ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="B001"
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
              ? "Actualizar sucursal"
              : "Crear sucursal"}
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
          { header: "Región" },
          { header: "Dirección" },
          { header: "Series" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Lista de sucursales"
      >
        {initialBranches.map((branch) => (
          <EntityTableRow key={branch.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {branch.name}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {branch.region}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {branch.address ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-xs text-gray-500">
              <div className="space-y-0.5">
                {branch.gre_serie && <div>GRE: {branch.gre_serie}</div>}
                {branch.factura_serie && <div>Fac: {branch.factura_serie}</div>}
                {branch.boleta_serie && <div>Bol: {branch.boleta_serie}</div>}
                {!branch.gre_serie && !branch.factura_serie && !branch.boleta_serie && "—"}
              </div>
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  branch.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {branch.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(branch.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={branch.id} />
                  <input type="hidden" name="active" value={String(branch.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      branch.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={branch.active ? "Desactivar" : "Activar"}
                  >
                    {branch.active ? (
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
        {initialBranches.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={6} className="py-8 text-center text-gray-500">
              No hay sucursales registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
