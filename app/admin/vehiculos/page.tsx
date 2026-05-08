import { createClient } from "@/lib/supabase/server";
import { VehiculosClient } from "./VehiculosClient";

export default async function VehiculosPage() {
  const supabase = await createClient();

  const [{ data: vehicles }, { data: branches }] = await Promise.all([
    supabase.from("re_vehicles").select("*, re_branches(name)").order("plate_number"),
    supabase.from("re_branches").select("id, name").eq("active", true).order("name"),
  ]);

  if (!vehicles) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar vehículos.
      </div>
    );
  }

  return <VehiculosClient initialVehicles={vehicles} branches={branches ?? []} />;
}
