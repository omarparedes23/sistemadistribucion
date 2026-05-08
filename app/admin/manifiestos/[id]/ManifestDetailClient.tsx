"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addOrderToManifest,
  removeOrderFromManifest,
  assignPersonnel,
  removePersonnel,
  assignVehicle,
  confirmManifest,
  transitionManifestToEnRoute,
  type ManifestState,
} from "@/lib/actions/manifests";
import {
  ArrowLeft,
  Trash2,
  Plus,
  CheckCircle,
  Truck,
  AlertTriangle,
  UserPlus,
} from "lucide-react";

type Manifest = {
  id: string;
  branch_id: string;
  warehouse_id: string;
  vehicle_id: string | null;
  status: string;
  manifest_date: string;
  total_weight_kg: number;
  total_volume_m3: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  re_branches: { name: string } | null;
  re_warehouses: { name: string } | null;
  re_vehicles: {
    plate_number: string;
    capacity_kg: number | null;
    capacity_m3: number | null;
  } | null;
};

type ManifestOrder = {
  manifest_id: string;
  order_id: string;
  delivery_sequence: number;
  delivery_status: string;
  re_orders: {
    id: string;
    status: string;
    total: number;
    re_customers: { legal_name: string; trade_name: string | null } | null;
  } | null;
};

type Personnel = {
  manifest_id: string;
  person_id: string;
  role: string;
  re_profiles: { full_name: string; role: string } | null;
};

type Vehicle = {
  id: string;
  plate_number: string;
  capacity_kg: number | null;
  capacity_m3: number | null;
};

type ApprovedOrder = {
  id: string;
  total: number;
  re_customers: { legal_name: string; trade_name: string | null } | null;
};

type BranchUser = {
  id: string;
  full_name: string;
  role: string;
};

type Gre = {
  serie: string;
  correlativo: string;
  sunat_status: string;
} | null;

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

const deliveryStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  DELIVERED: "Entregado",
  PARTIAL: "Parcial",
  REJECTED: "Rechazado",
};

export function ManifestDetailClient({
  manifest,
  orders,
  personnel,
  vehicles,
  approvedOrders,
  branchUsers,
  gre,
  userRole,
}: {
  manifest: Manifest;
  orders: ManifestOrder[];
  personnel: Personnel[];
  vehicles: Vehicle[];
  approvedOrders: ApprovedOrder[];
  branchUsers: BranchUser[];
  gre: Gre;
  userRole: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const isDraft = manifest.status === "DRAFT";
  const isConfirmed = manifest.status === "CONFIRMED";

  const setLoad = (key: string, val: boolean) =>
    setLoading((p) => ({ ...p, [key]: val }));

  async function handleAddOrder(orderId: string) {
    if (!orderId) return;
    setLoad("addOrder", true);
    setError(null);
    setWarning(null);
    const result = await addOrderToManifest(manifest.id, orderId);
    setLoad("addOrder", false);
    if (!result.success) {
      setError(result.error);
    } else {
      if (result.warning) setWarning(result.warning);
      router.refresh();
    }
  }

  async function handleRemoveOrder(orderId: string) {
    setLoad(`remove-${orderId}`, true);
    setError(null);
    const result = await removeOrderFromManifest(manifest.id, orderId);
    setLoad(`remove-${orderId}`, false);
    if (!result.success) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleConfirm() {
    setLoad("confirm", true);
    setError(null);
    const result = await confirmManifest(manifest.id);
    setLoad("confirm", false);
    if (!result.success) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleEnRoute() {
    setLoad("enRoute", true);
    setError(null);
    const result = await transitionManifestToEnRoute(manifest.id);
    setLoad("enRoute", false);
    if (!result.success) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleAssignVehicle(vehicleId: string) {
    if (!vehicleId) return;
    setLoad("assignVehicle", true);
    setError(null);
    const result = await assignVehicle(manifest.id, vehicleId);
    setLoad("assignVehicle", false);
    if (!result.success) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleAddPersonnel(personId: string, role: "DRIVER" | "ASSISTANT") {
    if (!personId) return;
    setLoad("addPersonnel", true);
    setError(null);
    const result = await assignPersonnel(manifest.id, personId, role);
    setLoad("addPersonnel", false);
    if (!result.success) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleRemovePersonnel(personId: string) {
    setLoad(`removePersonnel-${personId}`, true);
    setError(null);
    const result = await removePersonnel(manifest.id, personId);
    setLoad(`removePersonnel-${personId}`, false);
    if (!result.success) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  const hasDriver = personnel.some((p) => p.role === "DRIVER");
  const hasOrders = orders.length > 0;
  const hasVehicle = manifest.vehicle_id != null;

  const vehicle = manifest.re_vehicles;
  const weightExcess =
    vehicle?.capacity_kg != null && manifest.total_weight_kg > vehicle.capacity_kg;
  const volumeExcess =
    vehicle?.capacity_m3 != null && manifest.total_volume_m3 > vehicle.capacity_m3;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/manifiestos"
          className="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Detalle del manifiesto</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {warning}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs text-gray-500">ID: {manifest.id}</div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  statusStyles[manifest.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {statusLabels[manifest.status] ?? manifest.status}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(manifest.manifest_date).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                onClick={handleConfirm}
                disabled={loading["confirm"] || !hasDriver || !hasOrders || !hasVehicle}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {loading["confirm"] ? "Confirmando..." : "Confirmar"}
              </button>
            )}
            {isConfirmed && (
              <button
                onClick={handleEnRoute}
                disabled={loading["enRoute"]}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                <Truck className="h-4 w-4" />
                {loading["enRoute"] ? "Procesando..." : "Enviar a ruta"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-medium text-gray-500">Sucursal</div>
            <div className="text-sm text-gray-900">{manifest.re_branches?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Almacén</div>
            <div className="text-sm text-gray-900">{manifest.re_warehouses?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Vehículo</div>
            <div className="text-sm text-gray-900">
              {vehicle?.plate_number ?? (
                <span className="text-gray-400">Sin asignar</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">GRE</div>
            <div className="text-sm text-gray-900">
              {gre ? `${gre.serie}-${gre.correlativo} (${gre.sunat_status})` : "—"}
            </div>
          </div>
        </div>

        {/* Capacity indicator */}
        {vehicle && (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="text-xs font-medium text-gray-500">Capacidad</div>
            <div className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
              <div className={weightExcess ? "text-red-600" : "text-gray-700"}>
                Peso: {manifest.total_weight_kg.toFixed(2)} kg
                {vehicle.capacity_kg != null && (
                  <span className="text-gray-500"> / {vehicle.capacity_kg} kg</span>
                )}
                {weightExcess && (
                  <span className="ml-1 font-medium">
                    (exceso: {(manifest.total_weight_kg - (vehicle.capacity_kg ?? 0)).toFixed(2)} kg)
                  </span>
                )}
              </div>
              <div className={volumeExcess ? "text-red-600" : "text-gray-700"}>
                Volumen: {manifest.total_volume_m3.toFixed(4)} m³
                {vehicle.capacity_m3 != null && (
                  <span className="text-gray-500"> / {vehicle.capacity_m3} m³</span>
                )}
                {volumeExcess && (
                  <span className="ml-1 font-medium">
                    (exceso: {(manifest.total_volume_m3 - (vehicle.capacity_m3 ?? 0)).toFixed(4)} m³)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle assignment */}
      {isDraft && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Asignar vehículo</h2>
          <div className="flex items-center gap-3">
            <select
              defaultValue={manifest.vehicle_id ?? ""}
              onChange={(e) => handleAssignVehicle(e.target.value)}
              disabled={loading["assignVehicle"]}
              className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Selecciona un vehículo</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number}
                  {v.capacity_kg != null ? ` — ${v.capacity_kg} kg` : ""}
                  {v.capacity_m3 != null ? ` — ${v.capacity_m3} m³` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Pedidos asignados ({orders.length})
          </h2>
          {isDraft && approvedOrders.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                id="addOrderSelect"
                disabled={loading["addOrder"]}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Agregar pedido...</option>
                {approvedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.re_customers?.trade_name ?? o.re_customers?.legal_name ?? o.id.slice(0, 8)} — S/ {Number(o.total).toFixed(2)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const select = document.getElementById("addOrderSelect") as HTMLSelectElement;
                  handleAddOrder(select.value);
                }}
                disabled={loading["addOrder"]}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            No hay pedidos asignados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-4">Seq</th>
                  <th className="pb-2 pr-4">Pedido</th>
                  <th className="pb-2 pr-4">Cliente</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Estado entrega</th>
                  {isDraft && <th className="pb-2">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((mo) => (
                  <tr key={mo.order_id}>
                    <td className="py-2 pr-4 text-gray-500">{mo.delivery_sequence}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                      <Link
                        href={`/admin/pedidos/${mo.order_id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {mo.order_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {mo.re_orders?.re_customers?.trade_name ??
                        mo.re_orders?.re_customers?.legal_name ??
                        "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      S/ {Number(mo.re_orders?.total ?? 0).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {deliveryStatusLabels[mo.delivery_status] ?? mo.delivery_status}
                      </span>
                    </td>
                    {isDraft && (
                      <td className="py-2">
                        <button
                          onClick={() => handleRemoveOrder(mo.order_id)}
                          disabled={loading[`remove-${mo.order_id}`]}
                          className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Personnel */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Personal asignado ({personnel.length})
          </h2>
          {isDraft && branchUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                id="addPersonnelSelect"
                disabled={loading["addPersonnel"]}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Agregar personal...</option>
                {branchUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
              <select
                id="addPersonnelRole"
                disabled={loading["addPersonnel"]}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="DRIVER">Conductor</option>
                <option value="ASSISTANT">Asistente</option>
              </select>
              <button
                onClick={() => {
                  const select = document.getElementById("addPersonnelSelect") as HTMLSelectElement;
                  const roleSelect = document.getElementById("addPersonnelRole") as HTMLSelectElement;
                  handleAddPersonnel(select.value, roleSelect.value as "DRIVER" | "ASSISTANT");
                }}
                disabled={loading["addPersonnel"]}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          )}
        </div>

        {personnel.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            No hay personal asignado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Rol</th>
                  {isDraft && <th className="pb-2">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {personnel.map((p) => (
                  <tr key={p.person_id}>
                    <td className="py-2 pr-4 text-gray-700">
                      {p.re_profiles?.full_name ?? p.person_id.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.role === "DRIVER"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.role === "DRIVER" ? "Conductor" : "Asistente"}
                      </span>
                    </td>
                    {isDraft && (
                      <td className="py-2">
                        <button
                          onClick={() => handleRemovePersonnel(p.person_id)}
                          disabled={loading[`removePersonnel-${p.person_id}`]}
                          className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Validation hints for confirm */}
      {isDraft && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <div className="mb-1 font-medium text-gray-700">Requisitos para confirmar:</div>
          <ul className="ml-4 list-disc space-y-0.5">
            <li className={hasDriver ? "text-green-600" : "text-red-600"}>
              {hasDriver ? "✓ Conductor asignado" : "✗ Conductor requerido"}
            </li>
            <li className={hasOrders ? "text-green-600" : "text-red-600"}>
              {hasOrders ? "✓ Al menos un pedido" : "✗ Al menos un pedido requerido"}
            </li>
            <li className={hasVehicle ? "text-green-600" : "text-red-600"}>
              {hasVehicle ? "✓ Vehículo asignado" : "✗ Vehículo requerido"}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
