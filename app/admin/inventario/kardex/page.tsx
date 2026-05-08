import { createClient } from "@/lib/supabase/server";
import { KardexClient } from "../KardexClient";

export default async function KardexPage() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("re_products")
    .select("id, name, sku")
    .eq("active", true)
    .order("name");

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar productos: {error.message}
      </div>
    );
  }

  return <KardexClient products={products ?? []} />;
}
