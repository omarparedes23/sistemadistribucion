import { createClient } from "@/lib/supabase/server";
import { DireccionesClient } from "./DireccionesClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function DireccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const supabase = await createClient();

  if (!customerId) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/clientes"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center text-gray-500">
          Selecciona un cliente para ver sus direcciones.
        </div>
      </div>
    );
  }

  const [
    { data: addresses, error },
    { data: customer },
  ] = await Promise.all([
    supabase
      .from("re_customer_addresses")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("re_customers")
      .select("id, legal_name")
      .eq("id", customerId)
      .single(),
  ]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar direcciones: {error.message}
      </div>
    );
  }

  return (
    <DireccionesClient
      initialAddresses={addresses ?? []}
      customerId={customerId}
      customerName={customer?.legal_name ?? ""}
    />
  );
}
