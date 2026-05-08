"use client";

import { useState, useActionState } from "react";
import { createManifest, type ManifestState } from "@/lib/actions/manifests";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Eye, Plus, ClipboardList } from "lucide-react";
import Link from "next/link";

type Manifest = {
  id: string;
  status: string;
  manifest_date: string;
  total_weight_kg: number;
  total_volume_m3: number;
  created_at: string;
  re_branches: { name: string } | null;
  re_warehouses: { name: string } | null;
  re_vehicles: { plate_number: string } | null;
  re_manifest_orders: { count: number }[] | null;
};

type Branch = { id: string; name: string };
type Warehouse = { id: string; name: string; branch_id: string };

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  EN_ROUTE: "En ruta",
  CLOSED: "Cerrado",
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  CONFIRMED: "bg-blue-50 text-blue-700",
  EN_ROUTE: "bg-purple-50 text-purple-700",
  CLOSED: "bg-green-50 text-green-700",
};

export function ManifestosClient({
  initialManifests,
  branches,
  warehouses,
}: {
  initialManifests: Manifest[];
  branches: Branch[];
  warehouses: Warehouse[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  const [formState, formAction, isPending] = useActionState<
    ManifestState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await createManifest(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const filteredWarehouses = warehouses.filter(
    (w) => !selectedBranch || w.branch_id === selectedBranch
  );

  const filtered = initialManifests.filter((m) => {
    if (statusFilter && m.status !== statusFilter) return false;
    if (branchFilter && m.re_branches?.name !== branchFilter) return false;
    const d = new Date(m.manifest_date);
    if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const orderCount = (m: Manifest) => {
    const arr = m.re_manifest_orders;
    if (!arr || arr.length === 0) return 0;
    if (typeof arr[0] === "object" && "count" in arr[0]) {
      return (arr[0] as any).count ?? 0;
    }
    return arr.length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Manifiestos de despacho</h1>
      </div>

      <form
        action={formAction}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        {formState?.success === false && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {formState.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="branch_id" className="text-sm font-medium text-gray-700">
              Sucursal <span className="text-red-500">*</span>
            </label>
            <select
              id="branch_id"
              name="branch_id"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
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
            <label htmlFor="warehouse_id" className="text-sm font-medium text-gray-700">
              Almacén <span className="text-red-500">*</span>
            </label>
            <select
              id="warehouse_id"
              name="warehouse_id"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona un almacén</option>
              {filteredWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isPending ? "Creando..." : "Crear manifiesto"}
            </button>
          </div>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Sucursal</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <EntityTable
        columns={[
          { header: "ID" },
          { header: "Sucursal" },
          { header: "Almacén" },
          { header: "Vehículo" },
          { header: "Estado" },
          { header: "Fecha" },
          { header: "Pedidos" },
          { header: "Acciones", className: "w-32" },
        ]}
        caption="Lista de manifiestos"
      >
        {filtered.map((m) => (
          <EntityTableRow key={m.id}>
            <EntityTableCell className="font-mono text-xs text-gray-500">
              {m.id.slice(0, 8)}
            </EntityTableCell>
            <EntityTableCell className="text-gray-700">
              {m.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {m.re_warehouses?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {m.re_vehicles?.plate_number ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  statusStyles[m.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {statusLabels[m.status] ?? m.status}
              </span>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {new Date(m.manifest_date).toLocaleDateString()}
            </EntityTableCell>
            <EntityTableCell className="text-gray-700">
              {orderCount(m)}
            </EntityTableCell>
            <EntityTableCell>
              <Link
                href={`/admin/manifiestos/${m.id}`}
                className="inline-flex items-center gap-1 rounded p-1.5 text-sm text-indigo-600 transition hover:bg-indigo-50"
              >
                <Eye className="h-4 w-4" />
                Ver
              </Link>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {filtered.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={8} className="py-8 text-center text-gray-500">
              No hay manifiestos que coincidan con los filtros.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
