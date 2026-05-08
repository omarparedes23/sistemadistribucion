import { createClient } from "@/lib/supabase/server";
import { ManifestosClient } from "./ManifestosClient";

export default async function ManifestosPage() {
  const supabase = await createClient();

  const [
    { data: manifests },
    { data: branches },
    { data: warehouses },
  ] = await Promise.all([
    (supabase as any)
      .from("re_dispatch_manifests")
      .select(
        `id, status, manifest_date, total_weight_kg, total_volume_m3, created_at,
        re_branches(name),
        re_warehouses(name),
        re_vehicles(plate_number),
        re_manifest_orders(count)`
      )
      .order("created_at", { ascending: false }),
    supabase.from("re_branches").select("id, name").eq("active", true).order("name"),
    supabase.from("re_warehouses").select("id, name, branch_id").eq("active", true).order("name"),
  ]);

  if (!manifests) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar manifiestos.
      </div>
    );
  }

  return (
    <ManifestosClient
      initialManifests={manifests ?? []}
      branches={branches ?? []}
      warehouses={warehouses ?? []}
    />
  );
}
