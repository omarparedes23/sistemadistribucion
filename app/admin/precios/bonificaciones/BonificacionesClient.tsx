"use client";

import { useState, useActionState } from "react";
import { createPromotionRule, updatePromotionRule, togglePromotionRuleActive, type PromotionRuleState } from "@/lib/actions/pricing";
import { EntityTable, EntityTableRow, EntityTableCell } from "../../_components/EntityTable";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";

type PromotionRule = {
  id: string;
  branch_id: string;
  name: string;
  min_quantity: number;
  bonus_product_id: string | null;
  bonus_quantity: number;
  valid_from: string;
  valid_until: string | null;
  active: boolean;
  bonus_product: { name: string; sku: string } | null;
};

type Branch = { id: string; name: string };
type Product = { id: string; name: string; sku: string };

export function BonificacionesClient({
  initialRules,
  branches,
  products,
}: {
  initialRules: PromotionRule[];
  branches: Branch[];
  products: Product[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState<PromotionRuleState | null, FormData>(
    async (_prev, formData) => {
      const id = formData.get("id") as string;
      const result = id ? await updatePromotionRule(null, formData) : await createPromotionRule(null, formData);
      if (result.success) window.location.reload();
      return result;
    }, null
  );

  const toggleStateTuple = useActionState<PromotionRuleState | null, FormData>(
    async (_prev, formData) => {
      const result = await togglePromotionRuleActive(null, formData);
      if (result.success) window.location.reload();
      return result;
    }, null
  );
  const toggleAction = toggleStateTuple[1];
  const isTogglePending = toggleStateTuple[2];

  const editingRule = initialRules.find((r) => r.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reglas de Bonificación</h1>
      </div>

      <form key={editingId ?? "new"} action={formAction} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="id" value={editingId ?? ""} />

        {formState?.success === false && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{formState.error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">Nombre <span className="text-red-500">*</span></label>
            <input id="name" name="name" type="text" defaultValue={editingRule?.name ?? ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Ej. Promo 2x1" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="branch_id" className="text-sm font-medium text-gray-700">Sucursal <span className="text-red-500">*</span></label>
            <select id="branch_id" name="branch_id" defaultValue={editingRule?.branch_id ?? ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="">Selecciona sucursal</option>
              {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="min_quantity" className="text-sm font-medium text-gray-700">Cantidad mínima <span className="text-red-500">*</span></label>
            <input id="min_quantity" name="min_quantity" type="number" step="0.0001" min="0.0001" defaultValue={editingRule?.min_quantity ?? ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="0.0000" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bonus_product_id" className="text-sm font-medium text-gray-700">Producto bonificación</label>
            <select id="bonus_product_id" name="bonus_product_id" defaultValue={editingRule?.bonus_product_id ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="">Selecciona producto</option>
              {products.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.sku})</option>))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bonus_quantity" className="text-sm font-medium text-gray-700">Cantidad bonificación <span className="text-red-500">*</span></label>
            <input id="bonus_quantity" name="bonus_quantity" type="number" step="0.0001" min="0.0001" defaultValue={editingRule?.bonus_quantity ?? ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="0.0000" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="valid_from" className="text-sm font-medium text-gray-700">Vigente desde <span className="text-red-500">*</span></label>
            <input id="valid_from" name="valid_from" type="date" defaultValue={editingRule?.valid_from ?? ""} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="valid_until" className="text-sm font-medium text-gray-700">Vigente hasta</label>
            <input id="valid_until" name="valid_until" type="date" defaultValue={editingRule?.valid_until ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {isPending ? "Guardando..." : editingId ? "Actualizar regla" : "Crear regla"}
          </button>
          {editingId && (
            <button type="button" onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar edición</button>
          )}
        </div>
      </form>

      <EntityTable
        columns={[
          { header: "Nombre" },
          { header: "Sucursal" },
          { header: "Cantidad mínima", className: "text-right" },
          { header: "Bonificación" },
          { header: "Vigencia" },
          { header: "Estado" },
          { header: "Acciones", className: "w-40" },
        ]}
        caption="Reglas de bonificación"
      >
        {initialRules.map((rule) => {
          const branch = branches.find((b) => b.id === rule.branch_id);
          return (
            <EntityTableRow key={rule.id}>
              <EntityTableCell className="font-medium text-gray-900">{rule.name}</EntityTableCell>
              <EntityTableCell className="text-gray-500">{branch?.name ?? "—"}</EntityTableCell>
              <EntityTableCell className="text-right font-mono text-gray-700">{Number(rule.min_quantity).toFixed(4)}</EntityTableCell>
              <EntityTableCell className="text-gray-500">
                {rule.bonus_product ? (
                  <div><div>{rule.bonus_product.name}</div><div className="font-mono text-xs">{rule.bonus_product.sku} × {Number(rule.bonus_quantity).toFixed(4)}</div></div>
                ) : "—"}
              </EntityTableCell>
              <EntityTableCell className="text-gray-500">
                <div className="text-xs"><div>Desde: {rule.valid_from}</div>{rule.valid_until && <div>Hasta: {rule.valid_until}</div>}</div>
              </EntityTableCell>
              <EntityTableCell>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rule.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {rule.active ? "Activo" : "Inactivo"}
                </span>
              </EntityTableCell>
              <EntityTableCell>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingId(rule.id)} className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                  <form action={toggleAction} className="inline">
                    <input type="hidden" name="id" value={rule.id} />
                    <input type="hidden" name="active" value={String(rule.active)} />
                    <button type="submit" disabled={isTogglePending} className={`rounded p-1.5 transition hover:bg-gray-100 ${rule.active ? "text-gray-500 hover:text-red-600" : "text-gray-500 hover:text-green-600"}`} title={rule.active ? "Desactivar" : "Activar"}>
                      {rule.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                  </form>
                </div>
              </EntityTableCell>
            </EntityTableRow>
          );
        })}
        {initialRules.length === 0 && (
          <EntityTableRow>
            <EntityTableCell colSpan={7} className="py-8 text-center text-gray-500">No hay reglas de bonificación registradas.</EntityTableCell>
          </EntityTableRow>
        )}
      </EntityTable>
    </div>
  );
}
