import { createClient } from "@/lib/supabase/server";
import { ProductsClient } from "./ProductsClient";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: brands }] = await Promise.all([
    supabase.from("re_products").select("*, re_brands(name)").order("name"),
    supabase.from("re_brands").select("id, name").eq("active", true).order("name"),
  ]);

  if (!products) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar productos.
      </div>
    );
  }

  return <ProductsClient initialProducts={products} brands={brands ?? []} />;
}
