import { createClient } from "@/lib/supabase/server";
import { StockClient } from "./StockClient";

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: stock, error } = await supabase
    .from("re_inventory_stock")
    .select(
      `*,
      re_products(name, sku),
      re_warehouses(name, re_branches(name))`
    )
    .order("re_products(name)");

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar stock: {error.message}
      </div>
    );
  }

  return <StockClient initialStock={stock ?? []} />;
}
