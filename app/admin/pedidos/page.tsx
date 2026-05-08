import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PedidosClient } from "./PedidosClient";

export default async function AdminPedidosPage() {
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
    .select("role, branch_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const [
    { data: orders, error },
    { data: branches },
  ] = await Promise.all([
    (supabase as any)
      .from("re_orders")
      .select(
        `id, status, payment_status, total, notes, created_at, updated_at,
        re_customers(legal_name, trade_name),
        re_branches(name)`
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("re_branches")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar pedidos: {error.message}
      </div>
    );
  }

  return (
    <PedidosClient
      initialOrders={orders ?? []}
      branches={branches ?? []}
      userRole={profile.role}
    />
  );
}
