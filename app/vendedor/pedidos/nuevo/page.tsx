import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NuevoPedidoClient } from "./NuevoPedidoClient";

export default async function NuevoPedidoPage() {
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

  const branchId = profile.branch_id;

  const [
    { data: customers },
    { data: routes },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("re_customers")
      .select("id, legal_name, trade_name")
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("legal_name"),
    supabase
      .from("re_sales_routes")
      .select("id, name")
      .eq("branch_id", branchId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("re_products")
      .select("id, name, sku, unit_of_measure")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <NuevoPedidoClient
      branchId={branchId}
      sellerId={user.id}
      customers={customers ?? []}
      routes={routes ?? []}
      products={products ?? []}
    />
  );
}
