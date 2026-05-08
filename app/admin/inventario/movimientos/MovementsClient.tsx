"use client";

import { useState, useMemo } from "react";
import { MovementForm } from "../_components/MovementForm";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../../_components/EntityTable";

type Movement = {
  id: string;
  type: "IN" | "OUT";
  reason_code: string;
  quantity: number;
  unit_cost: number;
  movement_date: string;
  notes: string | null;
  re_products: { id: string; name: string; sku: string } | null;
  re_warehouses: { name: string } | null;
  re_branches: { name: string } | null;
};

type Product = { id: string; name: string; sku: string };
type Warehouse = { id: string; name: string; branch_id: string };

const reasonLabels: Record<string, string> = {
  PURCHASE: "Compra",
  TRANSFER_IN: "Transferencia entrada",
  SALES_RETURN: "Devolución venta",
  ADJUSTMENT_IN: "Ajuste entrada",
  INITIAL_STOCK: "Stock inicial",
  SALE: "Venta",
  TRANSFER_OUT: "Transferencia salida",
  DAMAGE_EXPIRED: "Daño / Vencido",
  DAMAGE_BROKEN: "Daño / Roto",
  DAMAGE_LOST: "Daño / Perdido",
  ADJUSTMENT_OUT: "Ajuste salida",
};

export function MovementsClient({
  initialMovements,
  products,
  warehouses,
}: {
  initialMovements: Movement[];
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const filtered = useMemo(() => {
    return initialMovements.filter((m) => {
      if (filterProduct && m.re_products?.id !== filterProduct) return false;
      if (filterType && m.type !== filterType) return false;
      if (filterReason && m.reason_code !== filterReason) return false;
      if (filterDate && m.movement_date !== filterDate) return false;
      return true;
    });
  }, [initialMovements, filterProduct, filterType, filterReason, filterDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Movimientos de Inventario
        </h1>
      </div>

      <MovementForm products={products} warehouses={warehouses} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-gray-500">
              Producto
            </label>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Motivo
            </label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              {Object.entries(reasonLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Fecha</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <EntityTable
        columns={[
          { header: "Fecha" },
          { header: "Producto" },
          { header: "Almacén" },
          { header: "Sucursal" },
          { header: "Tipo" },
          { header: "Motivo" },
          { header: "Cantidad", className: "text-right" },
          { header: "Costo Unit.", className: "text-right" },
          { header: "Notas" },
        ]}
        caption="Listado de movimientos"
      >
        {filtered.map((m) => (
          <EntityTableRow key={m.id}>
            <EntityTableCell className="text-gray-500">
              {m.movement_date}
            </EntityTableCell>
            <EntityTableCell className="font-medium text-gray-900">
              {m.re_products?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {m.re_warehouses?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {m.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.type === "IN"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {m.type === "IN" ? "Entrada" : "Salida"}
              </span>
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {reasonLabels[m.reason_code] ?? m.reason_code}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(m.quantity).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(m.unit_cost).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell className="max-w-xs truncate text-gray-500">
              {m.notes ?? "—"}
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {filtered.length === 0 && (
          <EntityTableRow>
            <EntityTableCell
              colSpan={9}
              className="py-8 text-center text-gray-500"
            >
              No hay movimientos que coincidan con los filtros.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
