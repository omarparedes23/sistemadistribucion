import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrdersWithOutstandingBalance } from "@/lib/actions/orders";
import { VendedorCobranzasClient } from "./VendedorCobranzasClient";

export default async function VendedorCobranzasPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("re_profiles")
    .select("branch_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["seller", "supervisor", "admin"].includes(profile.role)) {
    redirect("/");
  }

  const { data: collections, error: colError } = await (supabase as any)
    .from("re_collections")
    .select(
      `id, payment_method, reference_number, total_collected, collected_at, parent_collection_id,
      re_collection_items(id, order_id, amount_applied, re_orders(status, total))`
    )
    .eq("seller_id", user.id)
    .order("collected_at", { ascending: false });

  const { data: settlements, error: setError } = await (supabase as any)
    .from("re_daily_settlements")
    .select("id, settlement_date, total_expected, total_collected_physical, status, created_at")
    .eq("seller_id", user.id)
    .order("settlement_date", { ascending: false });

  const ordersResult = await getOrdersWithOutstandingBalance(user.id);

  if (colError || setError) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar datos: {colError?.message || setError?.message}
      </div>
    );
  }

  return (
    <VendedorCobranzasClient
      collections={collections ?? []}
      settlements={settlements ?? []}
      orders={ordersResult.success ? ordersResult.orders : []}
      branchId={profile.branch_id}
    />
  );
}
