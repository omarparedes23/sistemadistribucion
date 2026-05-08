"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolvePrice } from "@/lib/actions/price-resolution";

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

function checkAdmin(role: string | undefined): { ok: true } | { ok: false; error: string } {
  if (role !== "admin") {
    return { ok: false, error: "Solo administradores pueden realizar esta acción" };
  }
  return { ok: true };
}

/* ─────────────── Schemas ─────────────── */

const orderItemSchema = z.object({
  product_id: z.string().uuid("Selecciona un producto válido"),
  quantity: z.number().positive("La cantidad debe ser mayor a 0"),
});

const createOrderSchema = z.object({
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  customer_id: z.string().uuid("Selecciona un cliente válido"),
  delivery_address_id: z.string().uuid("Selecciona una dirección válida"),
  sales_route_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, "El pedido debe tener al menos un ítem"),
});

/* ─────────────── Types ─────────────── */

export type OrderState =
  | { success: true; message?: string; orderId?: string }
  | { success: false; error: string };

/* ═══════════════════════════════════════
   2.1 createOrder
   ═══════════════════════════════════════ */

export async function createOrder(
  input: z.infer<typeof createOrderSchema>
): Promise<OrderState> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const {
    branch_id,
    customer_id,
    delivery_address_id,
    sales_route_id,
    notes,
    items,
  } = parsed.data;

  // Insert re_orders row with DRAFT status
  const { data: order, error: orderError } = await supabase
    .from("re_orders")
    .insert({
      branch_id,
      customer_id,
      seller_id: user.id,
      delivery_address_id,
      sales_route_id,
      notes,
      status: "DRAFT",
      total: 0,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { success: false, error: orderError?.message || "Error al crear el pedido" };
  }

  const today = new Date().toISOString().split("T")[0];
  const orderItemsPayload: Array<{
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    is_bonus: boolean;
  }> = [];

  for (const item of items) {
    const priceResult = await resolvePrice(customer_id, item.product_id, branch_id);
    if (!priceResult.success) {
      return {
        success: false,
        error: `No se pudo resolver el precio para el producto ${item.product_id}: ${priceResult.error}`,
      };
    }

    // Find applicable discount rule (highest discount_pct that meets min_quantity)
    const { data: discountRules } = await supabase
      .from("re_discount_rules")
      .select("discount_pct")
      .eq("price_list_id", priceResult.price_list_id)
      .eq("product_id", item.product_id)
      .eq("active", true)
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .lte("min_quantity", item.quantity)
      .order("discount_pct", { ascending: false })
      .limit(1);

    const discount_pct = discountRules && discountRules.length > 0 ? discountRules[0].discount_pct : 0;

    orderItemsPayload.push({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: priceResult.unit_price,
      discount_pct,
      is_bonus: false,
    });
  }

  const { error: itemsError } = await supabase.from("re_order_items").insert(orderItemsPayload);
  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  revalidatePath("/admin/orders");
  return { success: true, message: "Pedido creado correctamente", orderId: order.id };
}

/* ═══════════════════════════════════════
   2.2 submitToPending
   ═══════════════════════════════════════ */

export async function submitToPending(orderId: string): Promise<OrderState> {
  const idParse = z.string().uuid().safeParse(orderId);
  if (!idParse.success) {
    return { success: false, error: "ID de pedido inválido" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const { data: order, error: orderError } = await supabase
    .from("re_orders")
    .select("status, seller_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  if (order.status !== "DRAFT") {
    return { success: false, error: "Solo los pedidos en borrador pueden ser enviados" };
  }

  if (order.seller_id !== user.id) {
    return { success: false, error: "No puedes enviar un pedido de otro vendedor" };
  }

  const { data: items, error: itemsError } = await supabase
    .from("re_order_items")
    .select("id")
    .eq("order_id", orderId);

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }
  if (!items || items.length === 0) {
    return { success: false, error: "El pedido debe tener al menos un ítem" };
  }

  // Calculate total from generated line_total values
  const { data: lineRows, error: sumError } = await supabase
    .from("re_order_items")
    .select("line_total")
    .eq("order_id", orderId);

  if (sumError) {
    return { success: false, error: sumError.message };
  }

  const total = (lineRows ?? []).reduce((sum, row) => sum + Number(row.line_total), 0);

  const { error: updateError } = await supabase
    .from("re_orders")
    .update({ status: "PENDING", total })
    .eq("id", orderId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/admin/orders");
  return { success: true, message: "Pedido enviado correctamente" };
}

/* ═══════════════════════════════════════
   2.3 transitionOrder
   ═══════════════════════════════════════ */

export async function transitionOrder(
  orderId: string,
  newState: string,
  deliveredQuantities?: Record<string, number>
): Promise<OrderState> {
  const validStates = [
    "PENDING",
    "APPROVED",
    // "PROGRAMMED" is now manifest-only; do not allow direct transition
    "EN_ROUTE",
    "DELIVERED",
    "PARTIAL",
    "REJECTED",
    "CANCELLED",
  ];

  if (!validStates.includes(newState)) {
    return { success: false, error: "Estado de transición inválido" };
  }

  const idParse = z.string().uuid().safeParse(orderId);
  if (!idParse.success) {
    return { success: false, error: "ID de pedido inválido" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase.rpc("re_transition_order_state", {
    p_order_id: orderId,
    p_to_state: newState,
    p_user_id: user.id,
    p_returned_items: deliveredQuantities ?? null,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid_transition")) {
      return { success: false, error: "Transición de estado no permitida" };
    }
    if (msg.includes("unauthorized")) {
      return { success: false, error: "No tienes permiso para realizar esta transición" };
    }
    if (msg.includes("no_items")) {
      return { success: false, error: "El pedido no tiene ítems" };
    }
    if (msg.includes("already_terminal")) {
      return { success: false, error: "El pedido ya está en un estado terminal" };
    }
    return { success: false, error: error.message };
  }

  if (typeof data === "string") {
    switch (data) {
      case "OK":
        break;
      case "INVALID_TRANSITION":
        return { success: false, error: "Transición de estado no permitida" };
      case "UNAUTHORIZED":
        return { success: false, error: "No tienes permiso para realizar esta transición" };
      case "NO_ITEMS":
        return { success: false, error: "El pedido no tiene ítems" };
      case "ALREADY_TERMINAL":
        return { success: false, error: "El pedido ya está en un estado terminal" };
      default:
        if (data !== "OK") {
          return { success: false, error: `Código de respuesta: ${data}` };
        }
    }
  }

  revalidatePath("/admin/orders");
  return { success: true, message: `Pedido actualizado a ${newState}` };
}

/* ═══════════════════════════════════════
   2.4 cancelOrder
   ═══════════════════════════════════════ */

export async function cancelOrder(orderId: string): Promise<OrderState> {
  const idParse = z.string().uuid().safeParse(orderId);
  if (!idParse.success) {
    return { success: false, error: "ID de pedido inválido" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const adminCheck = checkAdmin(profile?.role);
  if (!adminCheck.ok) {
    return { success: false, error: adminCheck.error };
  }

  const { data: order, error: orderError } = await supabase
    .from("re_orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  const terminalStates = ["DELIVERED", "PARTIAL", "REJECTED", "CANCELLED"];
  if (terminalStates.includes(order.status)) {
    return { success: false, error: "No se puede cancelar un pedido en estado terminal" };
  }

  return transitionOrder(orderId, "CANCELLED");
}

/* ═══════════════════════════════════════
   FormData wrappers for client components
   ═══════════════════════════════════════ */

export async function transitionOrderForm(
  _prevState: OrderState | null,
  formData: FormData
): Promise<OrderState> {
  const orderId = formData.get("id") as string;
  const newState = formData.get("status") as string;
  if (!orderId || !newState) {
    return { success: false, error: "ID y estado requeridos" };
  }
  return transitionOrder(orderId, newState);
}

export async function createOrderForm(
  _prevState: OrderState | null,
  formData: FormData
): Promise<OrderState> {
  const branch_id = formData.get("branch_id") as string;
  const customer_id = formData.get("customer_id") as string;
  const delivery_address_id = formData.get("delivery_address_id") as string;
  const sales_route_id = formData.get("sales_route_id") as string || null;
  const notes = formData.get("notes") as string || null;
  const itemsJson = formData.get("items") as string;

  let items: Array<{ product_id: string; quantity: number }> = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { success: false, error: "Formato de ítems inválido" };
  }

  return createOrder({
    branch_id,
    customer_id,
    delivery_address_id,
    sales_route_id,
    notes,
    items,
  });
}

export async function submitToPendingForm(
  _prevState: OrderState | null,
  formData: FormData
): Promise<OrderState> {
  const orderId = formData.get("id") as string;
  if (!orderId) {
    return { success: false, error: "ID de pedido requerido" };
  }
  return submitToPending(orderId);
}

/* ═══════════════════════════════════════
   2.5 getOrdersWithOutstandingBalance
   ═══════════════════════════════════════ */

export type OrderWithBalance = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  outstanding: number;
  notes: string | null;
  created_at: string;
  re_customers: { legal_name: string; trade_name: string | null } | null;
};

export async function getOrdersWithOutstandingBalance(
  sellerId?: string
): Promise<{ success: true; orders: OrderWithBalance[] } | { success: false; error: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const targetSellerId = sellerId ?? user.id;

  const { data: orders, error } = await (supabase as any)
    .from("re_orders")
    .select(
      `id, status, payment_status, total, notes, created_at,
      re_customers(legal_name, trade_name)`
    )
    .in("status", ["DELIVERED", "PARTIAL"])
    .eq("seller_id", targetSellerId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const orderIds = (orders ?? []).map((o: any) => o.id);

  let itemsAgg: { order_id: string; amount_applied: number }[] = [];
  if (orderIds.length > 0) {
    const { data: agg } = await supabase
      .from("re_collection_items")
      .select("order_id, amount_applied")
      .in("order_id", orderIds);
    itemsAgg = agg ?? [];
  }

  const ordersWithBalance: OrderWithBalance[] = (orders ?? []).map((o: any) => {
    const collected = itemsAgg
      .filter((i) => i.order_id === o.id)
      .reduce((s, i) => s + Number(i.amount_applied), 0);
    return {
      id: o.id,
      status: o.status,
      payment_status: o.payment_status,
      total: Number(o.total),
      outstanding: Number(o.total) - collected,
      notes: o.notes,
      created_at: o.created_at,
      re_customers: o.re_customers,
    };
  });

  return { success: true, orders: ordersWithBalance };
}
