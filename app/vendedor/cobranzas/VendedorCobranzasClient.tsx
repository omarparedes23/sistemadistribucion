"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../admin/_components/EntityTable";
import {
  submitDailySettlementForm,
  type SettlementState,
} from "@/lib/actions/collections";
import { PlusCircle, Send, Banknote } from "lucide-react";

type Collection = {
  id: string;
  payment_method: string;
  reference_number: string | null;
  total_collected: number;
  collected_at: string;
  parent_collection_id: string | null;
  re_collection_items: {
    id: string;
    order_id: string;
    amount_applied: number;
    re_orders: { status: string; total: number } | null;
  }[];
};

type Settlement = {
  id: string;
  settlement_date: string;
  total_expected: number;
  total_collected_physical: number | null;
  status: string;
  created_at: string;
};

type Order = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  outstanding: number;
  notes: string | null;
  created_at: string;
  re_customers: { legal_name: string; trade_name: string | null } | null;
};

const settlementStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  DISCREPANCY: "Discrepancia",
};

const settlementStatusStyles: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  APPROVED: "bg-green-50 text-green-700",
  DISCREPANCY: "bg-red-50 text-red-700",
};

export function VendedorCobranzasClient({
  collections,
  settlements,
  orders,
  branchId,
}: {
  collections: Collection[];
  settlements: Settlement[];
  orders: Order[];
  branchId: string;
}) {
  const [settlementState, settlementAction, isPending] = useActionState<
    SettlementState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await submitDailySettlementForm(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const todayLima = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });
  const todaySettlement = settlements.find((s) => s.settlement_date === todayLima);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cobranzas</h1>
        <Link
          href="/vendedor/cobranzas/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo cobro
        </Link>
      </div>

      {/* Orders with outstanding balance */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Pedidos pendientes de cobro</h2>
        <EntityTable
          columns={[
            { header: "Cliente" },
            { header: "Total" },
            { header: "Pendiente" },
            { header: "Estado" },
            { header: "Acción" },
          ]}
          caption="Pedidos pendientes de cobro"
        >
          {orders.map((o) => (
            <EntityTableRow key={o.id}>
              <EntityTableCell className="font-medium text-gray-900">
                {o.re_customers?.trade_name ?? o.re_customers?.legal_name ?? "—"}
              </EntityTableCell>
              <EntityTableCell className="text-gray-700">
                S/ {o.total.toFixed(2)}
              </EntityTableCell>
              <EntityTableCell className="text-gray-700">
                S/ {o.outstanding.toFixed(2)}
              </EntityTableCell>
              <EntityTableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    o.outstanding <= 0
                      ? "bg-green-50 text-green-700"
                      : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  {o.outstanding <= 0 ? "Pagado" : "Pendiente"}
                </span>
              </EntityTableCell>
              <EntityTableCell>
                <Link
                  href={`/vendedor/cobranzas/nuevo?orderId=${o.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Banknote className="h-3 w-3" />
                  Cobrar
                </Link>
              </EntityTableCell>
            </EntityTableRow>
          ))}
          {orders.length === 0 && (
            <EntityTableRow>
              <EntityTableCell colSpan={5} className="py-8 text-center text-gray-500">
                No hay pedidos pendientes de cobro.
              </EntityTableCell>
            </EntityTableRow>
          )}
        </EntityTable>
      </div>

      {/* Today's settlement */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Liquidación del día</h2>
            <p className="text-xs text-gray-500">{todayLima}</p>
          </div>
          {todaySettlement ? (
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  settlementStatusStyles[todaySettlement.status]
                }`}
              >
                {settlementStatusLabels[todaySettlement.status]}
              </span>
              <span className="text-sm text-gray-700">
                Esperado: S/ {Number(todaySettlement.total_expected).toFixed(2)}
              </span>
            </div>
          ) : (
            <form action={settlementAction} className="inline">
              <input type="hidden" name="branch_id" value={branchId} />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isPending ? "Enviando…" : "Enviar liquidación"}
              </button>
            </form>
          )}
        </div>
        {settlementState?.success === false && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {settlementState.error}
          </div>
        )}
      </div>

      {/* Collection history */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Historial de cobros</h2>
        <EntityTable
          columns={[
            { header: "Método" },
            { header: "Referencia" },
            { header: "Monto" },
            { header: "Pedidos" },
            { header: "Fecha" },
          ]}
          caption="Historial de cobros"
        >
          {collections.map((c) => (
            <EntityTableRow key={c.id}>
              <EntityTableCell className="font-medium text-gray-900">
                {c.payment_method}
              </EntityTableCell>
              <EntityTableCell className="text-gray-500">
                {c.reference_number ?? "—"}
              </EntityTableCell>
              <EntityTableCell className="text-gray-700">
                S/ {Number(c.total_collected).toFixed(2)}
              </EntityTableCell>
              <EntityTableCell className="text-gray-500">
                {c.re_collection_items?.length ?? 0} ítem(s)
              </EntityTableCell>
              <EntityTableCell className="text-gray-500">
                {new Date(c.collected_at).toLocaleDateString()}
              </EntityTableCell>
            </EntityTableRow>
          ))}
          {collections.length === 0 && (
            <EntityTableRow>
              <EntityTableCell colSpan={5} className="py-8 text-center text-gray-500">
                No hay cobros registrados.
              </EntityTableCell>
            </EntityTableRow>
          )}
        </EntityTable>
      </div>
    </div>
  );
}
