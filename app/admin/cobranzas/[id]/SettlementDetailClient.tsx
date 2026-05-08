"use client";

import { useState, useActionState } from "react";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import {
  approveSettlementForm,
  type SettlementState,
} from "@/lib/actions/collections";
import { CheckCircle, AlertTriangle } from "lucide-react";

type Settlement = {
  id: string;
  settlement_date: string;
  total_expected: number;
  total_collected_physical: number | null;
  status: string;
  supervisor_notes: string | null;
  approved_at: string | null;
  re_profiles: { full_name: string } | null;
};

type Collection = {
  id: string;
  payment_method: string;
  reference_number: string | null;
  total_collected: number;
  collected_at: string;
  re_collection_items: {
    id: string;
    order_id: string;
    amount_applied: number;
  }[];
};

export function SettlementDetailClient({
  settlement,
  collections,
}: {
  settlement: Settlement;
  collections: Collection[];
}) {
  const isPending = settlement.status === "PENDING";
  const [physical, setPhysical] = useState<number>(
    Number(settlement.total_collected_physical) || 0
  );
  const [notes, setNotes] = useState(settlement.supervisor_notes ?? "");

  const [formState, formAction, isSubmitting] = useActionState<
    SettlementState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await approveSettlementForm(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  const difference = physical - Number(settlement.total_expected);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Liquidación — {settlement.settlement_date}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            settlement.status === "APPROVED"
              ? "bg-green-50 text-green-700"
              : settlement.status === "DISCREPANCY"
              ? "bg-red-50 text-red-700"
              : "bg-yellow-50 text-yellow-700"
          }`}
        >
          {settlement.status === "APPROVED"
            ? "Aprobada"
            : settlement.status === "DISCREPANCY"
            ? "Discrepancia"
            : "Pendiente"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Vendedor</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {settlement.re_profiles?.full_name ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total esperado</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            S/ {Number(settlement.total_expected).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Diferencia</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              difference === 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            S/ {difference.toFixed(2)}
          </p>
        </div>
      </div>

      {isPending && (
        <form action={formAction} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="id" value={settlement.id} />

          {formState?.success === false && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {formState.error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Total físico contado
              </label>
              <input
                name="total_collected_physical"
                type="number"
                min="0"
                step="0.01"
                required
                value={physical}
                onChange={(e) => setPhysical(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Notas del supervisor
              </label>
              <input
                name="supervisor_notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Mínimo 20 caracteres si hay discrepancia"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              name="action"
              value="approve"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {isSubmitting ? "Procesando…" : "Aprobar"}
            </button>
            <button
              type="submit"
              name="action"
              value="discrepancy"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <AlertTriangle className="h-4 w-4" />
              {isSubmitting ? "Procesando…" : "Marcar discrepancia"}
            </button>
          </div>
        </form>
      )}

      {!isPending && settlement.supervisor_notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Notas del supervisor</p>
          <p className="mt-1 text-sm text-gray-700">{settlement.supervisor_notes}</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Cobros del día</h2>
        <EntityTable
          columns={[
            { header: "Método" },
            { header: "Referencia" },
            { header: "Monto" },
            { header: "Pedidos" },
            { header: "Hora" },
          ]}
          caption="Cobros del día"
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
                {new Date(c.collected_at).toLocaleTimeString()}
              </EntityTableCell>
            </EntityTableRow>
          ))}
          {collections.length === 0 && (
            <EntityTableRow>
              <EntityTableCell colSpan={5} className="py-8 text-center text-gray-500">
                No hay cobros para esta fecha.
              </EntityTableCell>
            </EntityTableRow>
          )}
        </EntityTable>
      </div>
    </div>
  );
}
