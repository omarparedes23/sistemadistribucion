import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrdersWithOutstandingBalance } from "@/lib/actions/orders";
import { NuevoCobroClient } from "./NuevoCobroClient";

export default async function NuevoCobroPage({
  searchParams,
}: {
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const { orderId } = searchParams ? await searchParams : {};
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

  const { data: customers } = await supabase
    .from("re_customers")
    .select("id, legal_name, trade_name")
    .eq("branch_id", profile.branch_id)
    .eq("active", true)
    .order("legal_name");

  const ordersResult = await getOrdersWithOutstandingBalance(user.id);

  return (
    <NuevoCobroClient
      branchId={profile.branch_id}
      sellerId={user.id}
      customers={customers ?? []}
      orders={ordersResult.success ? ordersResult.orders : []}
      preselectedOrderId={orderId ?? null}
    />
  );
}
