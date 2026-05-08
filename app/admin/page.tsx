import Link from "next/link";
import {
  Package,
  Tag,
  Tags,
  Building2,
  Warehouse,
  Banknote,
} from "lucide-react";

const modules = [
  {
    title: "Productos",
    description: "Gestiona el catálogo global de productos, SKUs y unidades de medida.",
    href: "/admin/products",
    icon: Package,
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "Marcas",
    description: "Administra las marcas asociadas a categorías.",
    href: "/admin/brands",
    icon: Tag,
    color: "bg-purple-50 text-purple-700",
  },
  {
    title: "Categorías",
    description: "Crea y edita las categorías del catálogo.",
    href: "/admin/categories",
    icon: Tags,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Sucursales",
    description: "Configura las sucursales operativas y sus series documentarias.",
    href: "/admin/branches",
    icon: Building2,
    color: "bg-amber-50 text-amber-700",
  },
  {
    title: "Almacenes",
    description: "Gestiona los almacenes vinculados a cada sucursal.",
    href: "/admin/warehouses",
    icon: Warehouse,
    color: "bg-rose-50 text-rose-700",
  },
  {
    title: "Cobranzas",
    description: "Aprueba liquidaciones y gestiona reversos de cobros.",
    href: "/admin/cobranzas",
    icon: Banknote,
    color: "bg-cyan-50 text-cyan-700",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestiona los datos maestros del sistema de reparto.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${mod.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 group-hover:text-indigo-700">
                {mod.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{mod.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
