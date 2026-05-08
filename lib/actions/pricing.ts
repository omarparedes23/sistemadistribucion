"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ─────────────── Shared helpers ─────────────── */

async function getCurrentUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No autenticado");
  return user;
}

async function getUserRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("re_profiles")
    .select("role, branch_id")
    .eq("id", userId)
    .single();
  return profile;
}

function checkAdminOrSupervisor(role: string | undefined): { ok: true } | { ok: false; error: string } {
  if (!role || !["admin", "supervisor"].includes(role)) {
    return { ok: false, error: "Solo admin o supervisor pueden realizar esta acción" };
  }
  return { ok: true };
}

export type PricingState =
  | { success: true; message?: string }
  | { success: false; error: string };

/* ─────────────── Schemas ─────────────── */

const priceListSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  valid_from: z.string().min(1, "La fecha de inicio es obligatoria"),
  valid_until: z.string().optional().nullable(),
  is_default: z.coerce.boolean(),
  active: z.coerce.boolean().optional(),
});

const priceListItemSchema = z.object({
  price_list_id: z.string().uuid("Selecciona una lista de precios válida"),
  product_id: z.string().uuid("Selecciona un producto válido"),
  unit_price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  currency: z.string().min(1).max(10).optional().nullable(),
  discount_pct: z.coerce.number().min(0).max(100).optional().nullable(),
});

const customerAssignmentSchema = z.object({
  customer_id: z.string().uuid("Selecciona un cliente válido"),
  price_list_id: z.string().uuid("Selecciona una lista de precios válida"),
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  assigned_from: z.string().min(1, "La fecha de inicio es obligatoria"),
  assigned_until: z.string().optional().nullable(),
  active: z.coerce.boolean().optional(),
});

const discountRuleSchema = z.object({
  price_list_id: z.string().uuid("Selecciona una lista de precios válida"),
  product_id: z.string().uuid("Selecciona un producto válido"),
  min_quantity: z.coerce.number().positive("La cantidad mínima debe ser mayor a 0"),
  discount_pct: z.coerce.number().min(0.01).max(100, "El descuento no puede superar el 100%"),
  valid_from: z.string().min(1, "La fecha de inicio es obligatoria"),
  valid_until: z.string().optional().nullable(),
  active: z.coerce.boolean().optional(),
});

const promotionRuleSchema = z.object({
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  min_quantity: z.coerce.number().positive("La cantidad mínima debe ser mayor a 0"),
  bonus_product_id: z.string().uuid().optional().nullable(),
  bonus_quantity: z.coerce.number().positive("La cantidad de bonificación debe ser mayor a 0").optional().nullable(),
  valid_from: z.string().min(1, "La fecha de inicio es obligatoria"),
  valid_until: z.string().optional().nullable(),
  active: z.coerce.boolean().optional(),
});

/* ═══════════════════════════════════════
   2.1 Price Lists
   ═══════════════════════════════════════ */

export async function createPriceList(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const parsed = priceListSchema.safeParse({
    name: formData.get("name"),
    branch_id: formData.get("branch_id"),
    valid_from: formData.get("valid_from"),
    valid_until: formData.get("valid_until") || null,
    is_default: formData.get("is_default") === "true",
    active: formData.get("active") === "true" || formData.get("active") === null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_lists").insert({
    ...parsed.data,
    active: parsed.data.active ?? true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Lista de precios creada correctamente" };
}

export async function updatePriceList(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const parsed = priceListSchema.safeParse({
    name: formData.get("name"),
    branch_id: formData.get("branch_id"),
    valid_from: formData.get("valid_from"),
    valid_until: formData.get("valid_until") || null,
    is_default: formData.get("is_default") === "true",
    active: formData.get("active") === "true",
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_lists").update(parsed.data).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Lista de precios actualizada correctamente" };
}

export async function deletePriceList(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_lists").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Lista de precios eliminada correctamente" };
}

export async function togglePriceListActive(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_lists").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: active ? "Lista de precios desactivada" : "Lista de precios activada" };
}

/* ═══════════════════════════════════════
   2.2 Price List Items
   ═══════════════════════════════════════ */

export async function createPriceListItem(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const parsed = priceListItemSchema.safeParse({
    price_list_id: formData.get("price_list_id"),
    product_id: formData.get("product_id"),
    unit_price: formData.get("unit_price"),
    currency: formData.get("currency") || "PEN",
    discount_pct: formData.get("discount_pct") || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_list_items").insert({
    ...parsed.data,
    currency: parsed.data.currency ?? "PEN",
    discount_pct: parsed.data.discount_pct ?? 0,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Item de lista de precios creado correctamente" };
}

export async function updatePriceListItem(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const parsed = priceListItemSchema.safeParse({
    price_list_id: formData.get("price_list_id"),
    product_id: formData.get("product_id"),
    unit_price: formData.get("unit_price"),
    currency: formData.get("currency") || "PEN",
    discount_pct: formData.get("discount_pct") || 0,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_list_items").update(parsed.data).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Item de lista de precios actualizado correctamente" };
}

export async function deletePriceListItem(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_price_list_items").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Item de lista de precios eliminado correctamente" };
}

/* ═══════════════════════════════════════
   2.3 Customer Assignments
   ═══════════════════════════════════════ */

export async function assignCustomerPriceList(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const parsed = customerAssignmentSchema.safeParse({
    customer_id: formData.get("customer_id"),
    price_list_id: formData.get("price_list_id"),
    branch_id: formData.get("branch_id"),
    assigned_from: formData.get("assigned_from"),
    assigned_until: formData.get("assigned_until") || null,
    active: formData.get("active") === "true" || formData.get("active") === null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customer_price_assignments").insert({
    ...parsed.data,
    active: parsed.data.active ?? true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Asignación de cliente creada correctamente" };
}

export async function removeCustomerAssignment(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customer_price_assignments").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Asignación de cliente eliminada correctamente" };
}

/* ═══════════════════════════════════════
   2.4 Discount Rules
   ═══════════════════════════════════════ */

export async function createDiscountRule(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const parsed = discountRuleSchema.safeParse({
    price_list_id: formData.get("price_list_id"),
    product_id: formData.get("product_id"),
    min_quantity: formData.get("min_quantity"),
    discount_pct: formData.get("discount_pct"),
    valid_from: formData.get("valid_from"),
    valid_until: formData.get("valid_until") || null,
    active: formData.get("active") === "true" || formData.get("active") === null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_discount_rules").insert({
    ...parsed.data,
    active: parsed.data.active ?? true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Regla de descuento creada correctamente" };
}

export async function updateDiscountRule(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const parsed = discountRuleSchema.safeParse({
    price_list_id: formData.get("price_list_id"),
    product_id: formData.get("product_id"),
    min_quantity: formData.get("min_quantity"),
    discount_pct: formData.get("discount_pct"),
    valid_from: formData.get("valid_from"),
    valid_until: formData.get("valid_until") || null,
    active: formData.get("active") === "true",
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_discount_rules").update(parsed.data).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Regla de descuento actualizada correctamente" };
}

export async function deleteDiscountRule(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_discount_rules").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Regla de descuento eliminada correctamente" };
}

/* ═══════════════════════════════════════
   2.5 Promotion Rules
   ═══════════════════════════════════════ */

export async function createPromotionRule(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const parsed = promotionRuleSchema.safeParse({
    branch_id: formData.get("branch_id"),
    name: formData.get("name"),
    min_quantity: formData.get("min_quantity"),
    bonus_product_id: formData.get("bonus_product_id") || null,
    bonus_quantity: formData.get("bonus_quantity") || 1,
    valid_from: formData.get("valid_from"),
    valid_until: formData.get("valid_until") || null,
    active: formData.get("active") === "true" || formData.get("active") === null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_promotion_rules").insert({
    ...parsed.data,
    bonus_quantity: parsed.data.bonus_quantity ?? 1,
    active: parsed.data.active ?? true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Regla de promoción creada correctamente" };
}

export async function updatePromotionRule(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const parsed = promotionRuleSchema.safeParse({
    branch_id: formData.get("branch_id"),
    name: formData.get("name"),
    min_quantity: formData.get("min_quantity"),
    bonus_product_id: formData.get("bonus_product_id") || null,
    bonus_quantity: formData.get("bonus_quantity") || 1,
    valid_from: formData.get("valid_from"),
    valid_until: formData.get("valid_until") || null,
    active: formData.get("active") === "true",
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_promotion_rules").update(parsed.data).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Regla de promoción actualizada correctamente" };
}

/* ═══════════════════════════════════════
   Type aliases for component imports
   ═══════════════════════════════════════ */

export type PriceListState = PricingState;
export { assignCustomerPriceList as createCustomerPriceAssignment };
export type PriceListItemState = PricingState;
export type CustomerPriceAssignmentState = PricingState;
export type DiscountRuleState = PricingState;
export type PromotionRuleState = PricingState;

/* ═══════════════════════════════════════
   Missing toggle/update helpers
   ═══════════════════════════════════════ */

export async function updateCustomerPriceAssignment(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const parsed = customerAssignmentSchema.safeParse({
    customer_id: formData.get("customer_id"),
    price_list_id: formData.get("price_list_id"),
    branch_id: formData.get("branch_id"),
    assigned_from: formData.get("assigned_from"),
    assigned_until: formData.get("assigned_until") || null,
    active: formData.get("active") === "true",
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customer_price_assignments").update(parsed.data).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Asignación actualizada correctamente" };
}

export async function toggleCustomerPriceAssignmentActive(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customer_price_assignments").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: active ? "Asignación desactivada" : "Asignación activada" };
}

export async function toggleDiscountRuleActive(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_discount_rules").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: active ? "Descuento desactivado" : "Descuento activado" };
}

export async function togglePromotionRuleActive(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_promotion_rules").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: active ? "Bonificación desactivada" : "Bonificación activada" };
}

export async function deletePromotionRule(
  _prevState: PricingState | null,
  formData: FormData
): Promise<PricingState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  if (!profile) return { success: false, error: "Perfil no encontrado" };

  const auth = checkAdminOrSupervisor(profile.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_promotion_rules").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/pricing");
  return { success: true, message: "Regla de promoción eliminada correctamente" };
}
