"use client";

import Link from "next/link";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";
import { Eye } from "lucide-react";

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

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  DISCREPANCY: "Discrepancia",
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  APPROVED: "bg-green-50 text-green-700",
  DISCREPANCY: "bg-red-50 text-red-700",
};

export function AdminCobranzasClient({ settlements }: { settlements: Settlement[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cobranzas y Liquidaciones</h1>
        <Link
          href="/admin/cobranzas/reversos"
          className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900"
        >
          Reversos
        </Link>
      </div>

      <EntityTable
        columns={[
          { header: "Fecha" },
          { header: "Vendedor" },
          { header: "Esperado" },
          { header: "Físico" },
          { header: "Diferencia" },
          { header: "Estado" },
          { header: "Acciones" },
        ]}
        caption="Lista de liquidaciones"
      >
        {settlements.map((s) => (
          <EntityTableRow key={s.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {s.settlement_date}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {s.re_profiles?.full_name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-700">
              S/ {Number(s.total_expected).toFixed(2)}
            </EntityTableCell>
            <EntityTableCell className="text-gray-700">
              S/ {Number(s.total_collected_physical).toFixed(2)}
            </EntityTableCell>
            <EntityTableCell className="text-gray-700">
              S/ {(
                Number(s.total_collected_physical) - Number(s.total_expected)
              ).toFixed(2)}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  statusStyles[s.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {statusLabels[s.status] ?? s.status}
              </span>
            </EntityTableCell>
            <EntityTableCell>
              <Link
                href={`/admin/cobranzas/${s.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <Eye className="h-3 w-3" />
                Ver
              </Link>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {settlements.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={7} className="py-8 text-center text-gray-500">
              No hay liquidaciones registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
