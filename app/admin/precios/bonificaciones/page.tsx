import { createClient } from "@/lib/supabase/server";
import { BonificacionesClient } from "./BonificacionesClient";

export default async function BonificacionesPage() {
  const supabase = await createClient();

  const [
    { data: rules },
    { data: branches },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("re_promotion_rules")
      .select(`*, bonus_product:re_products!re_promotion_rules_bonus_product_id_fkey(name, sku)`)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("re_branches")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    supabase
      .from("re_products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <BonificacionesClient
      initialRules={rules ?? []}
      branches={branches ?? []}
      products={products ?? []}
    />
  );
}
