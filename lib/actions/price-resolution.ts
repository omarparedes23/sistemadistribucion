"use server";

import { createClient } from "@/lib/supabase/server";

export type ResolvePriceResult =
  | { success: true; unit_price: number; currency: string; price_list_id: string }
  | { success: false; error: string };

/**
 * Resuelve el precio de un producto para un cliente en una sucursal
 * siguiendo la jerarquía:
 * 1. Asignación activa de lista de precios por cliente + sucursal
 * 2. Lista de precios por defecto (is_default) de la sucursal
 * 3. Item de lista de precios que coincida con producto
 */
export async function resolvePrice(
  customerId: string,
  productId: string,
  branchId: string
): Promise<ResolvePriceResult> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // ── 1. Buscar asignación activa de cliente ──────────────────────
  const { data: assignment, error: assignmentError } = await supabase
    .from("re_customer_price_assignments")
    .select("price_list_id")
    .eq("customer_id", customerId)
    .eq("branch_id", branchId)
    .eq("active", true)
    .lte("assigned_from", today)
    .or(`assigned_until.is.null,assigned_until.gte.${today}`)
    .maybeSingle();

  if (assignmentError) {
    return { success: false, error: assignmentError.message };
  }

  let priceListId: string | null = assignment?.price_list_id ?? null;

  // ── 2. Si no hay asignación, buscar lista por defecto ────────────
  if (!priceListId) {
    const { data: defaultList, error: defaultError } = await supabase
      .from("re_price_lists")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_default", true)
      .eq("active", true)
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .maybeSingle();

    if (defaultError) {
      return { success: false, error: defaultError.message };
    }

    priceListId = defaultList?.id ?? null;
  }

  // ── 3. Si aún no hay lista, retornar error ──────────────────────
  if (!priceListId) {
    return { success: false, error: "NO_PRICE_FOUND" };
  }

  // ── 4. Buscar item de lista de precios ──────────────────────────
  const { data: item, error: itemError } = await supabase
    .from("re_price_list_items")
    .select("unit_price, currency")
    .eq("price_list_id", priceListId)
    .eq("product_id", productId)
    .maybeSingle();

  if (itemError) {
    return { success: false, error: itemError.message };
  }

  if (!item) {
    return { success: false, error: "NO_PRICE_FOUND" };
  }

  return {
    success: true,
    unit_price: item.unit_price,
    currency: item.currency,
    price_list_id: priceListId,
  };
}
