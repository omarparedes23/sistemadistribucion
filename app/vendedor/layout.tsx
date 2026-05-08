import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LogOut, ClipboardList, PlusCircle, Banknote } from "lucide-react";

export default async function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("re_profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["seller", "supervisor", "admin"].includes(profile.role)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Vendedor</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            href="/vendedor/pedidos"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <ClipboardList className="h-4 w-4" />
            Mis pedidos
          </Link>
          <Link
            href="/vendedor/pedidos/nuevo"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo pedido
          </Link>
          <Link
            href="/vendedor/cobranzas"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <Banknote className="h-4 w-4" />
            Cobranzas
          </Link>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-gray-900">
                {profile.full_name}
              </p>
              <p className="truncate text-xs text-gray-500">
                {profile.role === "seller"
                  ? "Vendedor"
                  : profile.role === "supervisor"
                  ? "Supervisor"
                  : "Administrador"}
              </p>
            </div>
          </div>
          <form action="/api/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
