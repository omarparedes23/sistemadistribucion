"use client";

import { useState, useActionState } from "react";
import {
  createCustomerPriceAssignment,
  updateCustomerPriceAssignment,
  toggleCustomerPriceAssignmentActive,
  type CustomerPriceAssignmentState,
} from "@/lib/actions/pricing";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type Assignment = {
  id: string;
  customer_id: string;
  price_list_id: string;
  assigned_from: string;
  assigned_until: string | null;
  active: boolean;
  re_customers: { legal_name: string; ruc_or_dni: string } | null;
  re_price_lists: { name: string } | null;
};

type Customer = { id: string; legal_name: string; ruc_or_dni: string };
type PriceList = { id: string; name: string };

export function AsignacionesClient({
  initialAssignments,
  customers,
  priceLists,
}: {
  initialAssignments: Assignment[];
  customers: Customer[];
  priceLists: PriceList[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    CustomerPriceAssignmentState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateCustomerPriceAssignment(null, formData)
      : await createCustomerPriceAssignment(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    CustomerPriceAssignmentState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleCustomerPriceAssignmentActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingAssignment = initialAssignments.find((a) => a.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Asignaciones de Precios
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
            <label htmlFor="customer_id" className="text-sm font-medium text-gray-700">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              id="customer_id"
              name="customer_id"
              defaultValue={editingAssignment?.customer_id ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name} ({c.ruc_or_dni})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="price_list_id" className="text-sm font-medium text-gray-700">
              Lista de precios <span className="text-red-500">*</span>
            </label>
            <select
              id="price_list_id"
              name="price_list_id"
              defaultValue={editingAssignment?.price_list_id ?? ""}
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
            <label htmlFor="assigned_from" className="text-sm font-medium text-gray-700">
              Asignado desde <span className="text-red-500">*</span>
            </label>
            <input
              id="assigned_from"
              name="assigned_from"
              type="date"
              defaultValue={editingAssignment?.assigned_from ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="assigned_until" className="text-sm font-medium text-gray-700">
              Asignado hasta
            </label>
            <input
              id="assigned_until"
              name="assigned_until"
              type="date"
              defaultValue={editingAssignment?.assigned_until ?? ""}
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
              ? "Actualizar asignación"
              : "Crear asignación"}
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
          { header: "Cliente" },
          { header: "Lista de precios" },
          { header: "Asignado desde" },
          { header: "Asignado hasta" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Asignaciones de precios a clientes"
      >
        {initialAssignments.map((a) => (
          <EntityTableRow key={a.id}>
            <EntityTableCell className="font-medium text-gray-900">
              <div>{a.re_customers?.legal_name ?? "—"}</div>
              <div className="text-xs text-gray-500">
                {a.re_customers?.ruc_or_dni ?? "—"}
              </div>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {a.re_price_lists?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {a.assigned_from}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {a.assigned_until ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  a.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {a.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(a.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="active" value={String(a.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      a.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={a.active ? "Desactivar" : "Activar"}
                  >
                    {a.active ? (
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
        {initialAssignments.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={6} className="py-8 text-center text-gray-500">
              No hay asignaciones registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
