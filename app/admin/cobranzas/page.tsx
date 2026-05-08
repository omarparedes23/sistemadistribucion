import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminCobranzasClient } from "./AdminCobranzasClient";

export default async function AdminCobranzasPage() {
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

  const { data: settlements, error } = await (supabase as any)
    .from("re_daily_settlements")
    .select(
      `id, settlement_date, total_expected, total_collected_physical, status, supervisor_notes, approved_at,
      re_profiles(full_name)`
    )
    .eq("branch_id", profile.branch_id)
    .order("settlement_date", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar liquidaciones: {error.message}
      </div>
    );
  }

  return <AdminCobranzasClient settlements={settlements ?? []} />;
}
