import { createClient } from "@/lib/supabase/server";
import { WarehousesClient } from "./WarehousesClient";

export default async function WarehousesPage() {
  const supabase = await createClient();

  const [{ data: warehouses }, { data: branches }] = await Promise.all([
    supabase.from("re_warehouses").select("*, re_branches(name)").order("name"),
    supabase.from("re_branches").select("id, name").eq("active", true).order("name"),
  ]);

  if (!warehouses) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar almacenes.
      </div>
    );
  }

  return (
    <WarehousesClient
      initialWarehouses={warehouses}
      branches={branches ?? []}
    />
  );
}
