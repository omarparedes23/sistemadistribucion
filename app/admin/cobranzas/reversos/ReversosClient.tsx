"use client";

import { useState, useActionState } from "react";
import {
  createReversalForm,
  type CollectionState,
} from "@/lib/actions/collections";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import { RotateCcw } from "lucide-react";

type Collection = {
  id: string;
  payment_method: string;
  reference_number: string | null;
  total_collected: number;
  collected_at: string;
  seller_id: string;
  customer_id: string;
  re_profiles: { full_name: string } | null;
  re_customers: { legal_name: string; trade_name: string | null } | null;
};

export function ReversosClient({
  collections,
  role,
}: {
  collections: Collection[];
  role: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const selected = collections.find((c) => c.id === selectedId);

  const [formState, formAction, isPending] = useActionState<CollectionState | null, FormData>(
    async (_prev, formData) => {
      const result = await createReversalForm(null, formData);
      if (result.success) {
        window.location.reload();
      }
      return result;
    },
    null
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Reversos</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Selecciona un cobro</h2>
          <EntityTable
            columns={[
              { header: "Vendedor" },
              { header: "Cliente" },
              { header: "Monto" },
              { header: "Fecha" },
            ]}
            caption="Cobros disponibles para reverso"
          >
            {collections.map((c) => (
              <EntityTableRow
                key={c.id}
                className={selectedId === c.id ? "bg-indigo-50" : ""}
              >
                <EntityTableCell className="font-medium text-gray-900">
                  {c.re_profiles?.full_name ?? "—"}
                </EntityTableCell>
                <EntityTableCell className="text-gray-500">
                  {c.re_customers?.trade_name ?? c.re_customers?.legal_name ?? "—"}
                </EntityTableCell>
                <EntityTableCell className="text-gray-700">
                  S/ {Number(c.total_collected).toFixed(2)}
                </EntityTableCell>
                <EntityTableCell className="text-gray-500">
                  {new Date(c.collected_at).toLocaleDateString()}
                </EntityTableCell>
                <EntityTableCell>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  >
                    Seleccionar
                  </button>
                </EntityTableCell>
              </EntityTableRow>
            ))}
            {collections.length === 0 && (
              <EntityTableRow>
                <EntityTableCell colSpan={5} className="py-8 text-center text-gray-500">
                  No hay cobros disponibles.
                </EntityTableCell>
              </EntityTableRow>
            )}
          </EntityTable>
        </div>

        <div className="space-y-4">
          {selected ? (
            <form
              action={formAction}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <input
                type="hidden"
                name="original_collection_id"
                value={selected.id}
              />

              {formState?.success === false && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {formState.error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">Cobro seleccionado</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selected.re_customers?.trade_name ?? selected.re_customers?.legal_name} — S/{" "}
                    {Number(selected.total_collected).toFixed(2)} ({selected.payment_method})
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Motivo del reverso <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="reason"
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ej. Monto registrado incorrectamente"
                  />
                </div>

                <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  <p>Se creará un cobro reverso con monto negativo.</p>
                  {role !== "admin" && (
                    <p className="mt-1 text-red-600">
                      Solo admin puede reversar liquidaciones cerradas.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isPending ? "Creando…" : "Crear reverso"}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
              Selecciona un cobro de la lista para crear un reverso.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
