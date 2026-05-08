"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const transferSchema = z.object({
  from_branch_id: z.string().uuid(),
  from_warehouse_id: z.string().uuid(),
  to_branch_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export type TransferState =
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

export async function createTransfer(
  _prevState: TransferState | null,
  formData: FormData
): Promise<TransferState> {
  const parsed = transferSchema.safeParse({
    from_branch_id: formData.get("from_branch_id"),
    from_warehouse_id: formData.get("from_warehouse_id"),
    to_branch_id: formData.get("to_branch_id"),
    to_warehouse_id: formData.get("to_warehouse_id"),
    product_id: formData.get("product_id"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile) {
    return { success: false, error: "Perfil no encontrado" };
  }

  if (!["admin", "logistics"].includes(profile.role)) {
    return { success: false, error: "Solo admin o logística pueden crear transferencias" };
  }

  const data = parsed.data;

  // Validate different warehouse constraint
  if (data.from_branch_id === data.to_branch_id && data.from_warehouse_id === data.to_warehouse_id) {
    return { success: false, error: "El almacén origen y destino no pueden ser el mismo" };
  }

  const { error } = await supabase.from("re_stock_transfers").insert({
    ...data,
    requested_by: user.id,
    status: "PENDING",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/inventario/transferencias");
  return { success: true, message: "Transferencia creada correctamente" };
}

export async function dispatchTransfer(
  _prevState: TransferState | null,
  formData: FormData
): Promise<TransferState> {
  const transferId = formData.get("transfer_id") as string;
  if (!transferId) return { success: false, error: "ID de transferencia requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile) return { success: false, error: "Perfil no encontrado" };
  if (!["admin", "supervisor"].includes(profile.role)) {
    return { success: false, error: "Solo admin o supervisor pueden despachar" };
  }

  // Get transfer details
  const { data: transfer, error: fetchError } = await supabase
    .from("re_stock_transfers")
    .select("*")
    .eq("id", transferId)
    .single();

  if (fetchError || !transfer) {
    return { success: false, error: fetchError?.message || "Transferencia no encontrada" };
  }

  if (transfer.status !== "PENDING") {
    return { success: false, error: `La transferencia debe estar en PENDING, está en ${transfer.status}` };
  }

  // Get current weighted_avg_cost from source warehouse
  const { data: stock } = await supabase
    .from("re_inventory_stock")
    .select("weighted_avg_cost")
    .eq("branch_id", transfer.from_branch_id)
    .eq("warehouse_id", transfer.from_warehouse_id)
    .eq("product_id", transfer.product_id)
    .single();

  const unitCost = stock?.weighted_avg_cost ?? 0;

  // Create OUT movement
  const { error: moveError } = await supabase.from("re_inventory_movements").insert({
    branch_id: transfer.from_branch_id,
    warehouse_id: transfer.from_warehouse_id,
    product_id: transfer.product_id,
    type: "OUT",
    reason_code: "TRANSFER_OUT",
    quantity: transfer.quantity,
    unit_cost: unitCost,
    reference_id: transferId,
    reference_type: "transfer",
    user_id: user.id,
    movement_date: new Date().toISOString().split("T")[0],
  });

  if (moveError) {
    return { success: false, error: moveError.message };
  }

  // Update transfer status and record unit_cost
  const { error: updateError } = await supabase
    .from("re_stock_transfers")
    .update({ status: "IN_TRANSIT", unit_cost: unitCost })
    .eq("id", transferId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/admin/inventario/transferencias");
  return { success: true, message: "Transferencia despachada correctamente" };
}

export async function confirmTransfer(
  _prevState: TransferState | null,
  formData: FormData
): Promise<TransferState> {
  const transferId = formData.get("transfer_id") as string;
  if (!transferId) return { success: false, error: "ID de transferencia requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile) return { success: false, error: "Perfil no encontrado" };
  if (!["admin", "logistics"].includes(profile.role)) {
    return { success: false, error: "Solo admin o logística pueden confirmar recepción" };
  }

  const { data: transfer, error: fetchError } = await supabase
    .from("re_stock_transfers")
    .select("*")
    .eq("id", transferId)
    .single();

  if (fetchError || !transfer) {
    return { success: false, error: fetchError?.message || "Transferencia no encontrada" };
  }

  if (transfer.status !== "IN_TRANSIT") {
    return { success: false, error: `La transferencia debe estar en IN_TRANSIT, está en ${transfer.status}` };
  }

  // Create IN movement with the cost recorded at dispatch
  const { error: moveError } = await supabase.from("re_inventory_movements").insert({
    branch_id: transfer.to_branch_id,
    warehouse_id: transfer.to_warehouse_id,
    product_id: transfer.product_id,
    type: "IN",
    reason_code: "TRANSFER_IN",
    quantity: transfer.quantity,
    unit_cost: transfer.unit_cost,
    reference_id: transferId,
    reference_type: "transfer",
    user_id: user.id,
    movement_date: new Date().toISOString().split("T")[0],
  });

  if (moveError) {
    return { success: false, error: moveError.message };
  }

  const { error: updateError } = await supabase
    .from("re_stock_transfers")
    .update({ status: "CONFIRMED", confirmed_by: user.id })
    .eq("id", transferId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/admin/inventario/transferencias");
  return { success: true, message: "Transferencia confirmada correctamente" };
}

export async function updateTransferStatus(
  _prevState: TransferState | null,
  formData: FormData
): Promise<TransferState> {
  const transferId = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (!transferId || !status) return { success: false, error: "ID y estado requeridos" };

  const fd = new FormData();
  fd.append("transfer_id", transferId);

  switch (status) {
    case "IN_TRANSIT":
      return dispatchTransfer(_prevState, fd);
    case "CONFIRMED":
      return confirmTransfer(_prevState, fd);
    case "CANCELLED":
      return cancelTransfer(_prevState, fd);
    default:
      return { success: false, error: `Estado no soportado: ${status}` };
  }
}

export async function cancelTransfer(
  _prevState: TransferState | null,
  formData: FormData
): Promise<TransferState> {
  const transferId = formData.get("transfer_id") as string;
  const notes = formData.get("notes") as string;
  if (!transferId) return { success: false, error: "ID de transferencia requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile) return { success: false, error: "Perfil no encontrado" };
  if (profile.role !== "admin") {
    return { success: false, error: "Solo admin puede cancelar transferencias" };
  }

  const { data: transfer, error: fetchError } = await supabase
    .from("re_stock_transfers")
    .select("*")
    .eq("id", transferId)
    .single();

  if (fetchError || !transfer) {
    return { success: false, error: fetchError?.message || "Transferencia no encontrada" };
  }

  if (transfer.status === "CONFIRMED") {
    return { success: false, error: "No se puede cancelar una transferencia ya confirmada" };
  }

  if (transfer.status === "IN_TRANSIT") {
    // Requires reversal ADJUSTMENT_IN on source
    const { error: moveError } = await supabase.from("re_inventory_movements").insert({
      branch_id: transfer.from_branch_id,
      warehouse_id: transfer.from_warehouse_id,
      product_id: transfer.product_id,
      type: "IN",
      reason_code: "ADJUSTMENT_IN",
      quantity: transfer.quantity,
      unit_cost: transfer.unit_cost,
      reference_id: transferId,
      reference_type: "transfer",
      user_id: user.id,
      movement_date: new Date().toISOString().split("T")[0],
      notes: notes || `Reversión de transferencia cancelada ${transferId}`,
    });

    if (moveError) {
      return { success: false, error: moveError.message };
    }
  }

  const { error: updateError } = await supabase
    .from("re_stock_transfers")
    .update({ status: "CANCELLED", notes: notes || transfer.notes })
    .eq("id", transferId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/admin/inventario/transferencias");
  return { success: true, message: "Transferencia cancelada correctamente" };
}
