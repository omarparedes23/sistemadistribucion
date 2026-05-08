"use client";

import Link from "next/link";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../admin/_components/EntityTable";
import { PlusCircle, Banknote } from "lucide-react";

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
  updated_at: string;
  re_customers: { legal_name: string; trade_name: string | null } | null;
  re_branches: { name: string } | null;
};

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

 export function VendedorPedidosClient({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis pedidos</h1>
        <Link
          href="/vendedor/pedidos/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo pedido
        </Link>
      </div>

      <EntityTable
        columns={[
          { header: "ID" },
          { header: "Cliente" },
          { header: "Total" },
          { header: "Estado" },
          { header: "Fecha" },
          { header: "Acción" },
        ]}
        caption="Listado de mis pedidos"
      >
        {initialOrders.map((o) => (
          <EntityTableRow key={o.id}>
            <EntityTableCell className="font-mono text-xs text-gray-500">
              {o.id.slice(0, 8)}
            </EntityTableCell>
            <EntityTableCell className="font-medium text-gray-900">
              {o.re_customers?.trade_name ?? o.re_customers?.legal_name ?? "—"}
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
              {["DELIVERED", "PARTIAL"].includes(o.status) && (
                <Link
                  href={`/vendedor/cobranzas/nuevo?orderId=${o.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Banknote className="h-3 w-3" />
                  Cobrar
                </Link>
              )}
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {initialOrders.length === 0 && (
          <EntityTableRow>
            <EntityTableCell
              colSpan={5}
              className="py-8 text-center text-gray-500"
            >
              No tienes pedidos registrados.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
