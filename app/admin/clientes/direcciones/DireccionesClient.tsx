"use client";

import { useState, useActionState } from "react";
import {
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  type CustomerAddressState,
} from "@/lib/actions/customers";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

type CustomerAddress = {
  id: string;
  customer_id: string;
  address_line: string;
  district: string | null;
  province: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
};

export function DireccionesClient({
  initialAddresses,
  customerId,
  customerName,
}: {
  initialAddresses: CustomerAddress[];
  customerId: string;
  customerName: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<
    CustomerAddressState | null,
    FormData
  >(async (_prev, formData) => {
    const id = formData.get("id") as string;
    const result = id
      ? await updateCustomerAddress(null, formData)
      : await createCustomerAddress(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const [, deleteAction, isDeletePending] = useActionState<
    CustomerAddressState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await deleteCustomerAddress(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const editingAddress = initialAddresses.find((a) => a.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/clientes"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Direcciones de {customerName}
        </h1>
      </div>

      <form
        key={editingId ?? "new"}
        action={formAction}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="id" value={editingId ?? ""} />
        <input type="hidden" name="customer_id" value={customerId} />

        {formState?.success === false && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formState.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="address_line" className="text-sm font-medium text-gray-700">
              Dirección <span className="text-red-500">*</span>
            </label>
            <input
              id="address_line"
              name="address_line"
              type="text"
              defaultValue={editingAddress?.address_line ?? ""}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Av. Principal 123"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="district" className="text-sm font-medium text-gray-700">
              Distrito
            </label>
            <input
              id="district"
              name="district"
              type="text"
              defaultValue={editingAddress?.district ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Distrito"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="province" className="text-sm font-medium text-gray-700">
              Provincia
            </label>
            <input
              id="province"
              name="province"
              type="text"
              defaultValue={editingAddress?.province ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Provincia"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="department" className="text-sm font-medium text-gray-700">
              Departamento
            </label>
            <input
              id="department"
              name="department"
              type="text"
              defaultValue={editingAddress?.department ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Departamento"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="latitude" className="text-sm font-medium text-gray-700">
              Latitud
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              defaultValue={editingAddress?.latitude ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="-12.0464"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="longitude" className="text-sm font-medium text-gray-700">
              Longitud
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              defaultValue={editingAddress?.longitude ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="-77.0428"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <input
              id="is_primary"
              name="is_primary"
              type="checkbox"
              defaultChecked={editingAddress?.is_primary ?? false}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_primary" className="text-sm font-medium text-gray-700">
              Dirección principal
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
              ? "Actualizar dirección"
              : "Crear dirección"}
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
          { header: "Dirección" },
          { header: "Distrito" },
          { header: "Provincia" },
          { header: "Departamento" },
          { header: "Principal" },
          { header: "Coordenadas" },
          { header: "Acciones", className: "w-32" },
        ]}
        caption="Lista de direcciones"
      >
        {initialAddresses.map((a) => (
          <EntityTableRow key={a.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {a.address_line}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {a.district ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {a.province ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {a.department ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              {a.is_primary ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  Principal
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </EntityTableCell>
            <EntityTableCell className="text-xs text-gray-500">
              {a.latitude != null && a.longitude != null
                ? `${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)}`
                : "—"}
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
                <form action={deleteAction} className="inline">
                  <input type="hidden" name="id" value={a.id} />
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
        {initialAddresses.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={7} className="py-8 text-center text-gray-500">
              No hay direcciones registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
