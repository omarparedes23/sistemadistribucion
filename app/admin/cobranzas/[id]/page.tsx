import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettlementDetailClient } from "./SettlementDetailClient";

export default async function SettlementDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  if (!profile || !["supervisor", "admin"].includes(profile.role)) {
    redirect("/");
  }

  const { data: settlement, error } = await (supabase as any)
    .from("re_daily_settlements")
    .select(
      `id, settlement_date, total_expected, total_collected_physical, status, supervisor_notes, approved_at,
      seller_id,
      re_profiles!seller_id(full_name)`
    )
    .eq("id", params.id)
    .eq("branch_id", profile.branch_id)
    .single();

  if (error || !settlement) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Liquidación no encontrada.
      </div>
    );
  }

  // Fetch collections for this seller on this date
  const { data: collections } = await (supabase as any)
    .from("re_collections")
    .select(
      `id, payment_method, reference_number, total_collected, collected_at,
      re_collection_items(id, order_id, amount_applied)`
    )
    .eq("branch_id", profile.branch_id)
    .eq("seller_id", settlement.seller_id)
    .gte("collected_at", `${settlement.settlement_date}T00:00:00`)
    .lte("collected_at", `${settlement.settlement_date}T23:59:59`)
    .order("collected_at", { ascending: false });

  return (
    <SettlementDetailClient
      settlement={settlement}
      collections={collections ?? []}
    />
  );
}
