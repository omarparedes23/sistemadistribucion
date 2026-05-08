import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VendedorPedidosClient } from "./VendedorPedidosClient";

export default async function VendedorPedidosPage() {
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

  const { data: orders, error } = await (supabase as any)
    .from("re_orders")
    .select(
      `id, status, payment_status, total, notes, created_at, updated_at,
      re_customers(legal_name, trade_name),
      re_branches(name)`
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar pedidos: {error.message}
      </div>
    );
  }

  return <VendedorPedidosClient initialOrders={orders ?? []} />;
}
