import { createClient } from "@/lib/supabase/server";
import { BrandsClient } from "./BrandsClient";

export default async function BrandsPage() {
  const supabase = await createClient();

  const [{ data: brands }, { data: categories }] = await Promise.all([
    supabase.from("re_brands").select("*, re_categories(name)").order("name"),
    supabase.from("re_categories").select("id, name").eq("active", true).order("name"),
  ]);

  if (!brands) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar marcas.
      </div>
    );
  }

  return (
    <BrandsClient
      initialBrands={brands}
      categories={categories ?? []}
    />
  );
}
