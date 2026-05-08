"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";

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
  re_customers: {
    legal_name: string;
    trade_name: string | null;
    ruc_or_dni: string;
    phone: string | null;
  } | null;
  re_branches: { name: string } | null;
  re_sales_routes: { name: string } | null;
  re_profiles: { full_name: string } | null;
};

 type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  discount_amount: number;
  line_total: number;
  is_bonus: boolean;
  re_products: { name: string; sku: string; unit_of_measure: string } | null;
};

 type Invoice = {
  id: string;
  doc_type: string;
  serie: string;
  correlativo: string;
  total: number;
  sunat_status: string;
  created_at: string;
};

 type CreditNote = {
  id: string;
  serie: string;
  correlativo: string;
  reason: string;
  total: number;
  sunat_status: string;
  created_at: string;
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

 export function PedidoDetalleClient({
  order,
  items,
  invoices,
  creditNotes,
}: {
  order: Order;
  items: OrderItem[];
  invoices: Invoice[];
  creditNotes: CreditNote[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/pedidos"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Pedido {order.id.slice(0, 8)}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[order.status]}`}
        >
          {statusLabels[order.status]}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Cliente</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {order.re_customers?.trade_name ?? order.re_customers?.legal_name ?? "—"}
          </p>
          <p className="text-xs text-gray-500">
            RUC/DNI: {order.re_customers?.ruc_or_dni ?? "—"}
          </p>
          <p className="text-xs text-gray-500">
            Tel: {order.re_customers?.phone ?? "—"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Vendedor</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {order.re_profiles?.full_name ?? "—"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Sucursal / Ruta</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {order.re_branches?.name ?? "—"}
          </p>
          <p className="text-xs text-gray-500">
            {order.re_sales_routes?.name ?? "—"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Total</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            S/ {Number(order.total).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">
            Pago: {order.payment_status}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium uppercase text-gray-500">Notas</p>
          <p className="mt-1 text-sm text-gray-700">
            {order.notes ?? "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Ítems del pedido</h2>
        <EntityTable
          columns={[
            { header: "Producto" },
            { header: "Cantidad" },
            { header: "P. unitario" },
            { header: "Desc. %" },
            { header: "Total línea" },
          ]}
          caption="Ítems"
        >
          {items.map((it) => (
            <EntityTableRow key={it.id}>
              <EntityTableCell className="font-medium text-gray-900">
                <div>{it.re_products?.name ?? "—"}</div>
                <div className="font-mono text-xs text-gray-500">
                  {it.re_products?.sku ?? "—"}
                </div>
              </EntityTableCell>
              <EntityTableCell className="text-gray-700">
                {Number(it.quantity).toFixed(4)} {it.re_products?.unit_of_measure ?? ""}
                {it.is_bonus && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Bono
                  </span>
                )}
              </EntityTableCell>
              <EntityTableCell className="text-gray-700">
                S/ {Number(it.unit_price).toFixed(2)}
              </EntityTableCell>
              <EntityTableCell className="text-gray-700">
                {it.discount_pct.toFixed(2)}%
              </EntityTableCell>
              <EntityTableCell className="font-medium text-gray-900">
                S/ {Number(it.line_total).toFixed(2)}
              </EntityTableCell>
            </EntityTableRow>
          ))}
          {items.length === 0 && (
            <EntityTableRow>
              <EntityTableCell colSpan={5} className="py-8 text-center text-gray-500">
                Sin ítems.
              </EntityTableCell>
            </EntityTableRow>
          )}
        </EntityTable>
      </div>

      {invoices.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Comprobantes</h2>
          <EntityTable
            columns={[
              { header: "Tipo" },
              { header: "Serie-Correlativo" },
              { header: "Total" },
              { header: "SUNAT" },
              { header: "Fecha" },
            ]}
            caption="Facturas / Boletas"
          >
            {invoices.map((inv) => (
              <EntityTableRow key={inv.id}>
                <EntityTableCell className="text-gray-700">
                  {inv.doc_type}
                </EntityTableCell>
                <EntityTableCell className="font-mono text-sm text-gray-700">
                  {inv.serie}-{inv.correlativo}
                </EntityTableCell>
                <EntityTableCell className="text-gray-700">
                  S/ {Number(inv.total).toFixed(2)}
                </EntityTableCell>
                <EntityTableCell className="text-gray-700">
                  {inv.sunat_status}
                </EntityTableCell>
                <EntityTableCell className="text-gray-500">
                  {new Date(inv.created_at).toLocaleDateString()}
                </EntityTableCell>
              </EntityTableRow>
            ))}
          </EntityTable>
        </div>
      )}

      {creditNotes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Notas de crédito</h2>
          <EntityTable
            columns={[
              { header: "Serie-Correlativo" },
              { header: "Motivo" },
              { header: "Total" },
              { header: "SUNAT" },
              { header: "Fecha" },
            ]}
            caption="Notas de crédito"
          >
            {creditNotes.map((cn) => (
              <EntityTableRow key={cn.id}>
                <EntityTableCell className="font-mono text-sm text-gray-700">
                  {cn.serie}-{cn.correlativo}
                </EntityTableCell>
                <EntityTableCell className="text-gray-700">
                  {cn.reason}
                </EntityTableCell>
                <EntityTableCell className="text-gray-700">
                  S/ {Number(cn.total).toFixed(2)}
                </EntityTableCell>
                <EntityTableCell className="text-gray-700">
                  {cn.sunat_status}
                </EntityTableCell>
                <EntityTableCell className="text-gray-500">
                  {new Date(cn.created_at).toLocaleDateString()}
                </EntityTableCell>
              </EntityTableRow>
            ))}
          </EntityTable>
        </div>
      )}
    </div>
  );
}
