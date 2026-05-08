"use client";

import { useActionState } from "react";
import { updateTransferStatus, type TransferState } from "@/lib/actions/transfers";
import { TransferForm } from "../_components/TransferForm";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";
import { CheckCircle, XCircle, Send } from "lucide-react";

type Transfer = {
  id: string;
  quantity: number;
  unit_cost: number;
  status: "PENDING" | "IN_TRANSIT" | "CONFIRMED" | "CANCELLED";
  notes: string | null;
  created_at: string;
  from_branch: { name: string } | null;
  from_warehouse: { name: string } | null;
  to_branch: { name: string } | null;
  to_warehouse: { name: string } | null;
  product: { name: string; sku: string } | null;
};

type Branch = { id: string; name: string };
type Warehouse = { id: string; name: string; branch_id: string };
type Product = { id: string; name: string; sku: string };

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  IN_TRANSIT: "En tránsito",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  IN_TRANSIT: "bg-blue-50 text-blue-700",
  CONFIRMED: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export function TransferenciasClient({
  initialTransfers,
  branches,
  warehouses,
  products,
}: {
  initialTransfers: Transfer[];
  branches: Branch[];
  warehouses: Warehouse[];
  products: Product[];
}) {
  const [statusState, statusAction, isPending] = useActionState<
    TransferState | null,
    FormData
  >(async (_prev, formData) => {
    const result = await updateTransferStatus(null, formData);
    if (result.success) window.location.reload();
    return result;
  }, null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Transferencias de Stock
        </h1>
      </div>

      <TransferForm
        branches={branches}
        warehouses={warehouses}
        products={products}
      />

      {statusState?.success === false && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {statusState.error}
        </div>
      )}

      <EntityTable
        columns={[
          { header: "Producto" },
          { header: "Origen" },
          { header: "Destino" },
          { header: "Cantidad", className: "text-right" },
          { header: "Estado" },
          { header: "Fecha" },
          { header: "Acciones", className: "w-48" },
        ]}
        caption="Listado de transferencias"
      >
        {initialTransfers.map((t) => (
          <EntityTableRow key={t.id}>
            <EntityTableCell className="font-medium text-gray-900">
              <div>{t.product?.name ?? "—"}</div>
              <div className="font-mono text-xs text-gray-500">
                {t.product?.sku ?? "—"}
              </div>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              <div>{t.from_branch?.name ?? "—"}</div>
              <div className="text-xs">{t.from_warehouse?.name ?? "—"}</div>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              <div>{t.to_branch?.name ?? "—"}</div>
              <div className="text-xs">{t.to_warehouse?.name ?? "—"}</div>
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(t.quantity).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[t.status]}`}
              >
                {statusLabels[t.status]}
              </span>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {new Date(t.created_at).toLocaleDateString()}
            </EntityTableCell>
            <EntityTableCell>
              <div className="flex items-center gap-2">
                {t.status === "PENDING" && (
                  <>
                    <form action={statusAction} className="inline">
                      <input type="hidden" name="id" value={t.id} />
                      <input
                        type="hidden"
                        name="status"
                        value="IN_TRANSIT"
                      />
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
                        title="Marcar en tránsito"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                    <form action={statusAction} className="inline">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                        title="Cancelar"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </form>
                  </>
                )}
                {t.status === "IN_TRANSIT" && (
                  <form action={statusAction} className="inline">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value="CONFIRMED" />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-green-600"
                      title="Confirmar recepción"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {initialTransfers.length === 0 && (
          <EntityTableRow>
            <EntityTableCell
              colSpan={7}
              className="py-8 text-center text-gray-500"
            >
              No hay transferencias registradas.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
