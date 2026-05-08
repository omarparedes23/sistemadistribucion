import { createClient } from "@/lib/supabase/server";
import { TransferenciasClient } from "./TransferenciasClient";

export default async function TransferenciasPage() {
  const supabase = await createClient();

  const [
    { data: transfers },
    { data: branches },
    { data: warehouses },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("re_stock_transfers")
      .select(
        `*,
        from_branch:re_branches!re_stock_transfers_from_branch_id_fkey(name),
        from_warehouse:re_warehouses!re_stock_transfers_from_warehouse_id_fkey(name),
        to_branch:re_branches!re_stock_transfers_to_branch_id_fkey(name),
        to_warehouse:re_warehouses!re_stock_transfers_to_warehouse_id_fkey(name),
        product:re_products(name, sku)`
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("re_branches")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("re_warehouses")
      .select("id, name, branch_id")
      .eq("active", true)
      .order("name"),
    supabase
      .from("re_products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <TransferenciasClient
      initialTransfers={transfers ?? []}
      branches={branches ?? []}
      warehouses={warehouses ?? []}
      products={products ?? []}
    />
  );
}
