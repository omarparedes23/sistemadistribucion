import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./ClientesClient";

export default async function ClientesPage() {
  const supabase = await createClient();

  const [
    { data: customers, error },
    { data: branches },
  ] = await Promise.all([
    supabase
      .from("re_customers")
      .select(`*, re_branches(name)`)
      .order("legal_name"),
    supabase
      .from("re_branches")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar clientes: {error.message}
      </div>
    );
  }

  return (
    <ClientesClient
      initialCustomers={customers ?? []}
      branches={branches ?? []}
    />
  );
}
