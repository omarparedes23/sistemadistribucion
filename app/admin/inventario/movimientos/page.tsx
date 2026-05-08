import { createClient } from "@/lib/supabase/server";
import { MovementsClient } from "./MovementsClient";

export default async function MovimientosPage() {
  const supabase = await createClient();

  const [{ data: movements }, { data: products }, { data: warehouses }] =
    await Promise.all([
      supabase
        .from("re_inventory_movements")
        .select(
          `*,
          re_products(id, name, sku),
          re_warehouses(name),
          re_branches(name)`
        )
        .order("movement_date", { ascending: false })
        .limit(500),
      supabase
        .from("re_products")
        .select("id, name, sku")
        .eq("active", true)
        .order("name"),
      supabase
        .from("re_warehouses")
        .select("id, name, branch_id")
        .eq("active", true)
        .order("name"),
    ]);

  return (
    <MovementsClient
      initialMovements={movements ?? []}
      products={products ?? []}
      warehouses={warehouses ?? []}
    />
  );
}
