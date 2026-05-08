import { createClient } from "@/lib/supabase/server";
import { ItemsClient } from "./ItemsClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { listId } = await searchParams;
  const supabase = await createClient();

  if (!listId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/precios"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a listas
          </Link>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center text-gray-500">
          Selecciona una lista de precios para ver sus ítems.
        </div>
      </div>
    );
  }

  const [
    { data: items },
    { data: products },
    { data: priceLists },
  ] = await Promise.all([
    supabase
      .from("re_price_list_items")
      .select(`*, re_products(name, sku)`)
      .eq("price_list_id", listId)
      .order("re_products(name)"),
    supabase
      .from("re_products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name"),
    supabase
      .from("re_price_lists")
      .select("id, name")
      .eq("id", listId)
      .single(),
  ]);

  return (
    <ItemsClient
      initialItems={items ?? []}
      products={products ?? []}
      listId={listId}
      listName={priceLists?.name ?? ""}
    />
  );
}
