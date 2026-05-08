import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ManifestDetailClient } from "./ManifestDetailClient";

export default async function ManifestDetailPage({ params }: { params: { id: string } }) {
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

  if (!profile || !["admin", "supervisor"].includes(profile.role)) {
    redirect("/");
  }

  const { data: manifest, error: manifestError } = await (supabase as any)
    .from("re_dispatch_manifests")
    .select(
      `id, branch_id, warehouse_id, vehicle_id, status, manifest_date, total_weight_kg, total_volume_m3, created_by, created_at, updated_at,
      re_branches(name),
      re_warehouses(name),
      re_vehicles(plate_number, capacity_kg, capacity_m3)`
    )
    .eq("id", params.id)
    .single();

  if (manifestError || !manifest) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar el manifiesto: {manifestError?.message}
      </div>
    );
  }

  const [
    { data: manifestOrders },
    { data: personnel },
    { data: vehicles },
    { data: approvedOrders },
    { data: branchUsers },
    { data: gre },
  ] = await Promise.all([
    (supabase as any)
      .from("re_manifest_orders")
      .select(
        `manifest_id, order_id, delivery_sequence, delivery_status,
        re_orders(id, status, total, re_customers(legal_name, trade_name))`
      )
      .eq("manifest_id", params.id)
      .order("delivery_sequence"),
    (supabase as any)
      .from("re_manifest_personnel")
      .select(
        `manifest_id, person_id, role,
        re_profiles(full_name, role)`
      )
      .eq("manifest_id", params.id),
    supabase
      .from("re_vehicles")
      .select("id, plate_number, capacity_kg, capacity_m3")
      .eq("branch_id", manifest.branch_id)
      .eq("active", true)
      .order("plate_number"),
    (supabase as any)
      .from("re_orders")
      .select("id, total, re_customers(legal_name, trade_name)")
      .eq("branch_id", manifest.branch_id)
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false }),
    supabase
      .from("re_profiles")
      .select("id, full_name, role")
      .eq("branch_id", manifest.branch_id)
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("re_remission_guides")
      .select("serie, correlativo, sunat_status")
      .eq("manifest_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return (
    <ManifestDetailClient
      manifest={manifest}
      orders={manifestOrders ?? []}
      personnel={personnel ?? []}
      vehicles={vehicles ?? []}
      approvedOrders={approvedOrders ?? []}
      branchUsers={branchUsers ?? []}
      gre={gre && gre.length > 0 ? gre[0] : null}
      userRole={profile.role}
    />
  );
}
