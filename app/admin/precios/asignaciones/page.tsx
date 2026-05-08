import { createClient } from "@/lib/supabase/server";
import { AsignacionesClient } from "./AsignacionesClient";

export default async function AsignacionesPage() {
  const supabase = await createClient();

  const [
    { data: assignments },
    { data: customers },
    { data: priceLists },
  ] = await Promise.all([
    supabase
      .from("re_customer_price_assignments")
      .select(`*, re_customers(legal_name, ruc_or_dni), re_price_lists(name)`)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("re_customers")
      .select("id, legal_name, ruc_or_dni")
      .eq("active", true)
      .order("legal_name"),
    supabase
      .from("re_price_lists")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <AsignacionesClient
      initialAssignments={assignments ?? []}
      customers={customers ?? []}
      priceLists={priceLists ?? []}
    />
  );
}
