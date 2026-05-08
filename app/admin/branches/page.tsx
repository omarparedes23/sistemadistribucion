import { createClient } from "@/lib/supabase/server";
import { BranchesClient } from "./BranchesClient";

export default async function BranchesPage() {
  const supabase = await createClient();
  const { data: branches, error } = await supabase
    .from("re_branches")
    .select("*")
    .order("name");

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Error al cargar sucursales: {error.message}
      </div>
    );
  }

  return <BranchesClient initialBranches={branches ?? []} />;
}
