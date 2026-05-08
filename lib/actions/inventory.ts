"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const movementSchema = z.object({
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  warehouse_id: z.string().uuid("Selecciona un almacén válido"),
  product_id: z.string().uuid("Selecciona un producto válido"),
  type: z.enum(["IN", "OUT"]),
  reason_code: z.enum([
    "PURCHASE",
    "TRANSFER_IN",
    "SALES_RETURN",
    "ADJUSTMENT_IN",
    "INITIAL_STOCK",
    "SALE",
    "TRANSFER_OUT",
    "DAMAGE_EXPIRED",
    "DAMAGE_BROKEN",
    "DAMAGE_LOST",
    "ADJUSTMENT_OUT",
  ]),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unit_cost: z.coerce.number().min(0, "El costo no puede ser negativo").optional(),
  reference_id: z.string().uuid("Reference ID inválido"),
  reference_type: z.enum(["order", "transfer", "adjustment", "purchase"]),
  movement_date: z.string().min(1, "La fecha es obligatoria"),
  notes: z.string().optional(),
});

export type MovementState =
  | { success: true; message?: string }
  | { success: false; error: string };

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

export async function createMovement(
  _prevState: MovementState | null,
  formData: FormData
): Promise<MovementState> {
  const supabase = await createClient();

  // Infer branch_id from warehouse if not provided
  let branchId = formData.get("branch_id") as string;
  const warehouseId = formData.get("warehouse_id") as string;
  if (!branchId && warehouseId) {
    const { data: wh } = await supabase
      .from("re_warehouses")
      .select("branch_id")
      .eq("id", warehouseId)
      .single();
    branchId = wh?.branch_id ?? "";
  }

  // Auto-generate reference_id for manual movements if not provided
  let referenceId = formData.get("reference_id") as string;
  if (!referenceId) {
    referenceId = crypto.randomUUID();
  }

  // Default reference_type to 'adjustment' for manual movements
  let referenceType = formData.get("reference_type") as string;
  if (!referenceType) {
    referenceType = "adjustment";
  }

  const parsed = movementSchema.safeParse({
    branch_id: branchId,
    warehouse_id: warehouseId,
    product_id: formData.get("product_id"),
    type: formData.get("type"),
    reason_code: formData.get("reason_code"),
    quantity: formData.get("quantity"),
    unit_cost: formData.get("unit_cost") || undefined,
    reference_id: referenceId,
    reference_type: referenceType,
    movement_date: formData.get("movement_date"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile) {
    return { success: false, error: "Perfil no encontrado" };
  }

  const data = parsed.data;

  // Role validations per reason_code
  const allowedRoles: Record<string, string[]> = {
    PURCHASE: ["admin", "logistics"],
    TRANSFER_IN: ["admin", "logistics"],
    SALES_RETURN: ["driver", "admin"],
    ADJUSTMENT_IN: ["admin", "supervisor"],
    INITIAL_STOCK: ["admin"],
    SALE: ["driver", "admin"],
    TRANSFER_OUT: ["admin", "logistics"],
    DAMAGE_EXPIRED: ["admin", "supervisor"],
    DAMAGE_BROKEN: ["admin", "supervisor"],
    DAMAGE_LOST: ["admin", "supervisor"],
    ADJUSTMENT_OUT: ["admin", "supervisor"],
  };

  if (!allowedRoles[data.reason_code]?.includes(profile.role)) {
    return { success: false, error: `Rol '${profile.role}' no autorizado para ${data.reason_code}` };
  }

  // For OUT movements, fetch current weighted_avg_cost and use it
  if (data.type === "OUT") {
    const { data: stock } = await supabase
      .from("re_inventory_stock")
      .select("weighted_avg_cost")
      .eq("branch_id", data.branch_id)
      .eq("warehouse_id", data.warehouse_id)
      .eq("product_id", data.product_id)
      .single();

    data.unit_cost = stock?.weighted_avg_cost ?? 0;
  }

  // For IN movements without explicit unit_cost, default to 0
  if (data.type === "IN" && data.unit_cost === undefined) {
    data.unit_cost = 0;
  }

  const { error } = await supabase.from("re_inventory_movements").insert({
    ...data,
    user_id: user.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/movimientos");
  revalidatePath("/admin/inventario/kardex");
  return { success: true, message: "Movimiento registrado correctamente" };
}

export async function createInitialStock(
  _prevState: MovementState | null,
  formData: FormData
): Promise<MovementState> {
  // Override reason_code and reference_type for initial stock
  const fd = new FormData();
  fd.append("branch_id", formData.get("branch_id") as string);
  fd.append("warehouse_id", formData.get("warehouse_id") as string);
  fd.append("product_id", formData.get("product_id") as string);
  fd.append("type", "IN");
  fd.append("reason_code", "INITIAL_STOCK");
  fd.append("quantity", formData.get("quantity") as string);
  fd.append("unit_cost", formData.get("unit_cost") as string);
  fd.append("reference_id", formData.get("reference_id") as string || crypto.randomUUID());
  fd.append("reference_type", "adjustment");
  fd.append("movement_date", formData.get("movement_date") as string || new Date().toISOString().split("T")[0]);
  fd.append("notes", formData.get("notes") as string || "");

  return createMovement(_prevState, fd);
}

export async function recordDamage(
  _prevState: MovementState | null,
  formData: FormData
): Promise<MovementState> {
  const reasonCode = formData.get("reason_code") as string;
  const notes = formData.get("notes") as string;

  if (!notes || notes.trim().length === 0) {
    return { success: false, error: "Las notas son obligatorias para registros de daño" };
  }

  const fd = new FormData();
  fd.append("branch_id", formData.get("branch_id") as string);
  fd.append("warehouse_id", formData.get("warehouse_id") as string);
  fd.append("product_id", formData.get("product_id") as string);
  fd.append("type", "OUT");
  fd.append("reason_code", reasonCode);
  fd.append("quantity", formData.get("quantity") as string);
  fd.append("reference_id", formData.get("reference_id") as string || crypto.randomUUID());
  fd.append("reference_type", "adjustment");
  fd.append("movement_date", formData.get("movement_date") as string || new Date().toISOString().split("T")[0]);
  fd.append("notes", notes);

  return createMovement(_prevState, fd);
}

export async function recordAdjustment(
  _prevState: MovementState | null,
  formData: FormData
): Promise<MovementState> {
  const type = formData.get("type") as "IN" | "OUT";
  const notes = formData.get("notes") as string;

  if (!notes || notes.trim().length === 0) {
    return { success: false, error: "Las notas son obligatorias para ajustes" };
  }

  // First create adjustment record
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const { data: adjustment, error: adjError } = await supabase
    .from("re_adjustment_records")
    .insert({
      branch_id: formData.get("branch_id") as string,
      warehouse_id: formData.get("warehouse_id") as string,
      product_id: formData.get("product_id") as string,
      adjustment_type: type,
      quantity: Number(formData.get("quantity")),
      unit_cost: type === "IN" ? Number(formData.get("unit_cost")) : null,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (adjError || !adjustment) {
    return { success: false, error: adjError?.message || "Error al crear registro de ajuste" };
  }

  const fd = new FormData();
  fd.append("branch_id", formData.get("branch_id") as string);
  fd.append("warehouse_id", formData.get("warehouse_id") as string);
  fd.append("product_id", formData.get("product_id") as string);
  fd.append("type", type);
  fd.append("reason_code", type === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT");
  fd.append("quantity", formData.get("quantity") as string);
  if (type === "IN") {
    fd.append("unit_cost", formData.get("unit_cost") as string);
  }
  fd.append("reference_id", adjustment.id);
  fd.append("reference_type", "adjustment");
  fd.append("movement_date", formData.get("movement_date") as string || new Date().toISOString().split("T")[0]);
  fd.append("notes", notes);

  return createMovement(_prevState, fd);
}

export async function getKardex(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("re_inventory_movements")
    .select("id, movement_date, type, reason_code, quantity, unit_cost")
    .eq("product_id", productId)
    .order("movement_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
