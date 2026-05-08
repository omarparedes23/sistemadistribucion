"use client";

import { useState, useActionState } from "react";
import { transitionOrderForm, type OrderState } from "@/lib/actions/orders";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import {
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  PackageMinus,
  Ban,
  Eye,
} from "lucide-react";
import Link from "next/link";

 type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "PROGRAMMED"
  | "EN_ROUTE"
  | "DELIVERED"
  | "PARTIAL"
  | "REJECTED"
  | "CANCELLED";

 type Order = {
  id: string;
  status: OrderStatus;
  payment_status: string;
  total: number;
  notes: string | null;
  created_at: string;
  re_customers: { legal_name: string; trade_name: string | null } | null;
  re_branches: { name: string } | null;
};

 type Branch = { id: string; name: string };

 const statusLabels: Record<OrderStatus, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  PROGRAMMED: "Programado",
  EN_ROUTE: "En ruta",
  DELIVERED: "Entregado",
  PARTIAL: "Parcial",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

 const statusStyles: Record<OrderStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING: "bg-yellow-50 text-yellow-700",
  APPROVED: "bg-blue-50 text-blue-700",
  PROGRAMMED: "bg-indigo-50 text-indigo-700",
  EN_ROUTE: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-green-50 text-green-700",
  PARTIAL: "bg-orange-50 text-orange-700",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

 const terminalStatuses: OrderStatus[] = [
  "DELIVERED",
  "PARTIAL",
  "REJECTED",
  "CANCELLED",
];

 export function PedidosClient({
  initialOrders,
  branches,
  userRole,
}: {
  initialOrders: Order[];
  branches: Branch[];
  userRole: string;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [statusState, statusAction, isPending] = useActionState<
    OrderState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await transitionOrderForm(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const filtered = initialOrders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (branchFilter && o.re_branches?.name !== branchFilter) return false;
    const d = new Date(o.created_at);
    if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const transitionButton = (
    orderId: string,
    targetStatus: OrderStatus,
    label: string,
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <form action={statusAction} className="inline">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={targetStatus} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded p-1.5 transition hover:bg-gray-100 ${colorClass}`}
        title={label}
      >
        {icon}
      </button>
    </form>
  );

  const renderActions = (o: Order) => {
    const buttons: React.ReactNode[] = [];

    if (o.status === "PENDING" && ["supervisor", "admin"].includes(userRole)) {
      buttons.push(
        transitionButton(
          o.id,
          "APPROVED",
          "Aprobar",
          <CheckCircle className="h-4 w-4" />,
          "text-gray-500 hover:text-green-600"
        )
      );
    }

    if (o.status === "PROGRAMMED" && ["driver", "admin"].includes(userRole)) {
      buttons.push(
        transitionButton(
          o.id,
          "EN_ROUTE",
          "Enviar",
          <Truck className="h-4 w-4" />,
          "text-gray-500 hover:text-purple-600"
        )
      );
    }

    if (o.status === "EN_ROUTE" && ["driver", "admin"].includes(userRole)) {
      buttons.push(
        transitionButton(
          o.id,
          "DELIVERED",
          "Entregado",
          <PackageCheck className="h-4 w-4" />,
          "text-gray-500 hover:text-green-600"
        ),
        transitionButton(
          o.id,
          "PARTIAL",
          "Parcial",
          <PackageMinus className="h-4 w-4" />,
          "text-gray-500 hover:text-orange-600"
        ),
        transitionButton(
          o.id,
          "REJECTED",
          "Rechazado",
          <XCircle className="h-4 w-4" />,
          "text-gray-500 hover:text-red-600"
        )
      );
    }

    if (!terminalStatuses.includes(o.status) && userRole === "admin") {
      buttons.push(
        transitionButton(
          o.id,
          "CANCELLED",
          "Cancelar",
          <Ban className="h-4 w-4" />,
          "text-gray-500 hover:text-red-600"
        )
      );
    }

    return buttons;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
      </div>

      {statusState?.success === false && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {statusState.error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Estado
          </label>
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
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Sucursal
          </label>
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
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Desde
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Hasta
          </label>
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
          { header: "Cliente" },
          { header: "Sucursal" },
          { header: "Total" },
          { header: "Estado" },
          { header: "Fecha" },
          { header: "Acciones", className: "w-56" },
        ]}
        caption="Listado de pedidos"
      >
        {filtered.map((o) => (
          <EntityTableRow key={o.id}>
            <EntityTableCell className="font-mono text-xs text-gray-500">
              <Link
                href={`/admin/pedidos/${o.id}`}
                className="flex items-center gap-1 text-indigo-600 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                {o.id.slice(0, 8)}
              </Link>
            </EntityTableCell>
            <EntityTableCell className="font-medium text-gray-900">
              {o.re_customers?.trade_name ?? o.re_customers?.legal_name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {o.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-700">
              S/ {Number(o.total).toFixed(2)}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[o.status]}`}
              >
                {statusLabels[o.status]}
              </span>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {new Date(o.created_at).toLocaleDateString()}
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex flex-wrap items-center gap-1">
                {renderActions(o)}
              </div>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {filtered.length === 0 && (
          <EntityTableRow>
            <EntityTableCell
              colSpan={7}
              className="py-8 text-center text-gray-500"
            >
              No hay pedidos que coincidan con los filtros.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
