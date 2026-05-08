import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PedidoDetalleClient } from "./PedidoDetalleClient";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const { data: order, error: orderError } = await (supabase as any)
    .from("re_orders")
    .select(
      `id, branch_id, customer_id, seller_id, sales_route_id, delivery_address_id,
      status, payment_status, total, notes, created_at, updated_at,
      re_customers(legal_name, trade_name, ruc_or_dni, phone),
      re_branches(name),
      re_sales_routes(name),
      re_profiles(full_name)`
    )
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Pedido no encontrado.
      </div>
    );
  }

  const [{ data: items }, { data: invoices }, { data: creditNotes }] =
    await Promise.all([
      (supabase as any)
        .from("re_order_items")
        .select(
          `id, product_id, quantity, unit_price, discount_pct, discount_amount, line_total, is_bonus,
          re_products(name, sku, unit_of_measure)`
        )
        .eq("order_id", id)
        .order("created_at"),
      (supabase as any)
        .from("re_invoices")
        .select("id, doc_type, serie, correlativo, total, sunat_status, created_at")
        .eq("order_id", id)
        .order("created_at"),
      (supabase as any)
        .from("re_credit_notes")
        .select("id, serie, correlativo, reason, total, sunat_status, created_at")
        .eq("order_id", id)
        .order("created_at"),
    ]);

  return (
    <PedidoDetalleClient
      order={order}
      items={items ?? []}
      invoices={invoices ?? []}
      creditNotes={creditNotes ?? []}
    />
  );
}
