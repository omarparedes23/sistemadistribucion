import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReversosClient } from "./ReversosClient";

export default async function ReversosPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("re_profiles")
    .select("branch_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["supervisor", "admin"].includes(profile.role)) {
    redirect("/");
  }

  const { data: collections, error } = await (supabase as any)
    .from("re_collections")
    .select(
      `id, payment_method, reference_number, total_collected, collected_at, parent_collection_id,
      seller_id, customer_id,
      re_profiles!seller_id(full_name),
      re_customers(legal_name, trade_name)`
    )
    .eq("branch_id", profile.branch_id)
    .is("parent_collection_id", null)
    .order("collected_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar cobros: {error.message}
      </div>
    );
  }

  return <ReversosClient collections={collections ?? []} role={profile.role} />;
}
