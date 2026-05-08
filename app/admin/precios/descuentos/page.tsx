import { createClient } from "@/lib/supabase/server";
import { DescuentosClient } from "./DescuentosClient";

export default async function DescuentosPage() {
  const supabase = await createClient();

  const [
    { data: rules },
    { data: products },
    { data: priceLists },
  ] = await Promise.all([
    supabase
      .from("re_discount_rules")
      .select(`*, re_products(name, sku), re_price_lists(name)`)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("re_products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name"),
    supabase
      .from("re_price_lists")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <DescuentosClient
      initialRules={rules ?? []}
      products={products ?? []}
      priceLists={priceLists ?? []}
    />
  );
}
