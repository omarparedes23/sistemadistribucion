import { createClient } from "@/lib/supabase/server";
import { CategoriesClient } from "./CategoriesClient";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("re_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar categorías: {error.message}
      </div>
    );
  }

  return <CategoriesClient initialCategories={categories ?? []} />;
}
