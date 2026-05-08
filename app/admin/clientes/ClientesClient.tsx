"use client";

import { useState, useActionState } from "react";
import {
  createCustomer,
  updateCustomer,
  toggleCustomerActive,
  type CustomerState,
} from "@/lib/actions/customers";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus, MapPin } from "lucide-react";
import Link from "next/link";

type Customer = {
  id: string;
  branch_id: string;
  legal_name: string;
  trade_name: string | null;
  ruc_or_dni: string;
  phone: string | null;
  credit_limit: number | null;
  active: boolean;
  re_branches: { name: string } | null;
};

type Branch = { id: string; name: string };

export function ClientesClient({
  initialCustomers,
  branches,
}: {
  initialCustomers: Customer[];
  branches: Branch[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    CustomerState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateCustomer(null, formData)
      : await createCustomer(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const toggleStateTuple = useActionState<
    CustomerState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await toggleCustomerActive(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingCustomer = initialCustomers.find((c) => c.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
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
            <label htmlFor="branch_id" className="text-sm font-medium text-gray-700">
              Sucursal <span className="text-red-500">*</span>
            </label>
            <select
              id="branch_id"
              name="branch_id"
              defaultValue={editingCustomer?.branch_id ?? ""}
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

          <div className="space-y-1.5">
            <label htmlFor="ruc_or_dni" className="text-sm font-medium text-gray-700">
              RUC o DNI <span className="text-red-500">*</span>
            </label>
            <input
              id="ruc_or_dni"
              name="ruc_or_dni"
              type="text"
              defaultValue={editingCustomer?.ruc_or_dni ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="20123456789"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="legal_name" className="text-sm font-medium text-gray-700">
              Razón social <span className="text-red-500">*</span>
            </label>
            <input
              id="legal_name"
              name="legal_name"
              type="text"
              defaultValue={editingCustomer?.legal_name ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Nombre legal"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="trade_name" className="text-sm font-medium text-gray-700">
              Nombre comercial
            </label>
            <input
              id="trade_name"
              name="trade_name"
              type="text"
              defaultValue={editingCustomer?.trade_name ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Nombre comercial"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              defaultValue={editingCustomer?.phone ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="999888777"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="credit_limit" className="text-sm font-medium text-gray-700">
              Límite de crédito
            </label>
            <input
              id="credit_limit"
              name="credit_limit"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editingCustomer?.credit_limit ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={editingCustomer?.active ?? true}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
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
              ? "Actualizar cliente"
              : "Crear cliente"}
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
          { header: "Razón social" },
          { header: "Nombre comercial" },
          { header: "RUC/DNI" },
          { header: "Teléfono" },
          { header: "Límite de crédito" },
          { header: "Sucursal" },
          { header: "Estado" },
          { header: "Acciones", className: "w-48" },
        ]}
        caption="Lista de clientes"
      >
        {initialCustomers.map((c) => (
          <EntityTableRow key={c.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {c.legal_name}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {c.trade_name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {c.ruc_or_dni}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {c.phone ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {c.credit_limit != null
                ? `S/ ${c.credit_limit.toFixed(2)}`
                : "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {c.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  c.active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {c.active ? "Activo" : "Inactivo"}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(c.id)}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={toggleAction} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={String(c.active)} />
                  <button
                    type="submit"
                    disabled={isTogglePending}
                    className={`rounded p-1.5 transition hover:bg-gray-100 ${
                      c.active
                        ? "text-gray-500 hover:text-red-600"
                        : "text-gray-500 hover:text-green-600"
                    }`}
                    title={c.active ? "Desactivar" : "Activar"}
                  >
                    {c.active ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </button>
                </form>
                <Link
                  href={`/admin/clientes/direcciones?customerId=${c.id}`}
                  className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="Direcciones"
                >
                  <MapPin className="h-4 w-4" />
                </Link>
              </div>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {initialCustomers.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={8} className="py-8 text-center text-gray-500">
              No hay clientes registrados.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
