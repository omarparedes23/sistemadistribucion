"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Tag,
  Tags,
  Building2,
  Warehouse,
  Users,
  LogOut,
  Boxes,
  ArrowLeftRight,
  BookOpen,
  Truck,
  Car,
  ChevronDown,
  Receipt,
  ClipboardList,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType; adminOnly?: boolean };
type NavGroup = {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  adminOnly?: boolean;
};

const allNavItems: (NavItem | NavGroup)[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Productos", icon: Package, adminOnly: true },
  { href: "/admin/brands", label: "Marcas", icon: Tag, adminOnly: true },
  { href: "/admin/categories", label: "Categorías", icon: Tags, adminOnly: true },
  { href: "/admin/branches", label: "Sucursales", icon: Building2, adminOnly: true },
  { href: "/admin/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, adminOnly: true },
  { href: "/admin/manifiestos", label: "Manifiestos", icon: Truck, adminOnly: true },
  { href: "/admin/vehiculos", label: "Vehículos", icon: Car, adminOnly: true },
  { href: "/admin/warehouses", label: "Almacenes", icon: Warehouse, adminOnly: true },
  {
    label: "Inventario",
    icon: Boxes,
    adminOnly: true,
    items: [
      { href: "/admin/inventario", label: "Stock", icon: Boxes },
      {
        href: "/admin/inventario/movimientos",
        label: "Movimientos",
        icon: ArrowLeftRight,
      },
      { href: "/admin/inventario/kardex", label: "Kardex", icon: BookOpen },
      {
        href: "/admin/inventario/transferencias",
        label: "Transferencias",
        icon: Truck,
      },
    ],
  },
  {
    label: "Precios",
    icon: Receipt,
    adminOnly: true,
    items: [
      { href: "/admin/precios", label: "Listas", icon: Receipt },
      {
        href: "/admin/precios/asignaciones",
        label: "Asignaciones",
        icon: Receipt,
      },
      {
        href: "/admin/precios/descuentos",
        label: "Descuentos",
        icon: Receipt,
      },
      {
        href: "/admin/precios/bonificaciones",
        label: "Bonificaciones",
        icon: Receipt,
      },
    ],
  },
  { href: "/admin/cobranzas", label: "Cobranzas", icon: Receipt },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}

export function AdminNav({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();

  const navItems = allNavItems.filter((item) => {
    if (role === "admin") return true;
    // supervisor only sees non-adminOnly items
    if ("adminOnly" in item && item.adminOnly) return false;
    return true;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if ("items" in item) {
        initial[item.label] = isGroupActive(item, pathname);
      }
    });
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Package className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-900">Admin</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          if ("items" in item) {
            const isActive = isGroupActive(item, pathname);
            const isOpen = openGroups[item.label];
            const GroupIcon = item.icon;
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className="h-4 w-4" />
                    {item.label}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1 pl-10">
                    {item.items.map((sub) => {
                      const subActive =
                        pathname === sub.href ||
                        pathname.startsWith(`${sub.href}/`);
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            subActive
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                        >
                          <SubIcon className="h-4 w-4" />
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200" />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-gray-900">
              {userName}
            </p>
            <p className="truncate text-xs text-gray-500">
              {role === "admin" ? "Administrador" : "Supervisor"}
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
  );
}
