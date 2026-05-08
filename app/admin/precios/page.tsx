import { createClient } from "@/lib/supabase/server";
import { PreciosClient } from "./PreciosClient";

export default async function PreciosPage() {
  const supabase = await createClient();

  const [{ data: priceLists }, { data: branches }] = await Promise.all([
    supabase
      .from("re_price_lists")
      .select(`*, re_branches(name)`)
      .order("name"),
    supabase.from("re_branches").select("id, name").eq("active", true).order("name"),
  ]);

  if (!priceLists) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar listas de precios.
      </div>
    );
  }

  return (
    <PreciosClient
      initialPriceLists={priceLists}
      branches={branches ?? []}
    />
  );
}
