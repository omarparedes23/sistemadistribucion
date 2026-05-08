"use client";

import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";

type StockItem = {
  id: string;
  stock_actual: number;
  stock_reserved: number;
  stock_available: number;
  weighted_avg_cost: number;
  re_products: { name: string; sku: string } | null;
  re_warehouses: {
    name: string;
    re_branches: { name: string } | null;
  } | null;
};

export function StockClient({ initialStock }: { initialStock: StockItem[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Stock por Almacén</h1>
      </div>

      <EntityTable
        columns={[
          { header: "Producto" },
          { header: "SKU" },
          { header: "Almacén" },
          { header: "Sucursal" },
          { header: "Stock Actual", className: "text-right" },
          { header: "Reservado", className: "text-right" },
          { header: "Disponible", className: "text-right" },
          { header: "Costo Prom.", className: "text-right" },
        ]}
        caption="Stock actual por producto y almacén"
      >
        {initialStock.map((item) => (
          <EntityTableRow key={item.id}>
            <EntityTableCell className="font-medium text-gray-900">
              {item.re_products?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="font-mono text-xs text-gray-500">
              {item.re_products?.sku ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {item.re_warehouses?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-gray-500">
              {item.re_warehouses?.re_branches?.name ?? "—"}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(item.stock_actual).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(item.stock_reserved).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono font-medium text-gray-900">
              {Number(item.stock_available).toFixed(4)}
            </EntityTableCell>
            <EntityTableCell className="text-right font-mono text-gray-700">
              {Number(item.weighted_avg_cost).toFixed(4)}
            </EntityTableCell>
          </EntityTableRow>
        ))}
        {initialStock.length === 0 && (
          <EntityTableRow>
            <EntityTableCell
              colSpan={8}
              className="py-8 text-center text-gray-500"
            >
              No hay registros de stock.
            </EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
