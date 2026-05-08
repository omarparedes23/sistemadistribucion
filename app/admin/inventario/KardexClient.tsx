"use client";

import { useState } from "react";
import { getKardex } from "@/lib/actions/inventory";
import {
  EntityTable,
  EntityTableRow,
  EntityTableCell,
} from "../_components/EntityTable";

type Product = { id: string; name: string; sku: string };

type KardexMovement = {
  id: string;
  movement_date: string;
  type: "IN" | "OUT";
  reason_code: string;
  quantity: number;
  unit_cost: number;
};

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

export function KardexClient({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState("");
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSelect(id: string) {
    setProductId(id);
    if (!id) {
      setMovements([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getKardex(id);
      setMovements(data as KardexMovement[]);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }

  let runningBalance = 0;
  const rows = movements.map((m) => {
    const qty = Number(m.quantity);
    runningBalance += m.type === "IN" ? qty : -qty;
    return { ...m, balance: runningBalance };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kardex</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="kardex-product"
          className="text-sm font-medium text-gray-700"
        >
          Producto
        </label>
        <select
          id="kardex-product"
          value={productId}
          onChange={(e) => handleSelect(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Selecciona un producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Cargando kardex...</div>
      )}

      {productId && !loading && (
        <EntityTable
          columns={[
            { header: "Fecha" },
            { header: "Tipo" },
            { header: "Motivo" },
            { header: "Cantidad", className: "text-right" },
            { header: "Costo Unit.", className: "text-right" },
            { header: "Saldo Acum.", className: "text-right" },
          ]}
          caption="Kardex del producto"
        >
          {rows.map((m) => (
            <EntityTableRow key={m.id}>
              <EntityTableCell className="text-gray-500">
                {m.movement_date}
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
              <EntityTableCell className="text-right font-mono font-medium text-gray-900">
                {m.balance.toFixed(4)}
              </EntityTableCell>
            </EntityTableRow>
          ))}
          {rows.length === 0 && (
            <EntityTableRow>
              <EntityTableCell
                colSpan={6}
                className="py-8 text-center text-gray-500"
              >
                No hay movimientos para este producto.
              </EntityTableCell>
            </EntityTableRow>
          )}
        </EntityTable>
      )}
    </div>
  );
}
