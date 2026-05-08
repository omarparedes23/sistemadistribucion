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

function checkSupervisorOrAbove(role: string | undefined): { ok: true } | { ok: false; error: string } {
  if (!role || !["admin", "supervisor"].includes(role)) {
    return { ok: false, error: "Solo supervisor o admin pueden realizar esta acción" };
  }
  return { ok: true };
}

function checkAdmin(role: string | undefined): { ok: true } | { ok: false; error: string } {
  if (role !== "admin") {
    return { ok: false, error: "Solo administradores pueden realizar esta acción" };
  }
  return { ok: true };
}

/* ─────────────── Schemas ─────────────── */

const collectionItemSchema = z.object({
  order_id: z.string().uuid("Selecciona un pedido válido"),
  invoice_id: z.string().uuid().optional().nullable(),
  amount_applied: z.number().positive("El monto debe ser mayor a 0"),
});

const registerCollectionSchema = z.object({
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  customer_id: z.string().uuid("Selecciona un cliente válido"),
  payment_method: z.enum(["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA"]),
  reference_number: z.string().min(1).optional().nullable(),
  items: z.array(collectionItemSchema).min(1, "Debe haber al menos un ítem"),
});

/* ─────────────── Types ─────────────── */

export type CollectionState =
  | { success: true; message?: string; collectionId?: string }
  | { success: false; error: string };

export type SettlementState = CollectionState;

/* ═══════════════════════════════════════
   2.1 registerCollection
   ═══════════════════════════════════════ */

export async function registerCollection(
  input: z.infer<typeof registerCollectionSchema>
): Promise<CollectionState> {
  const parsed = registerCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile?.branch_id) {
    return { success: false, error: "Perfil incompleto" };
  }

  if (parsed.data.branch_id !== profile.branch_id) {
    return { success: false, error: "Sucursal no autorizada" };
  }

  const { branch_id, customer_id, payment_method, reference_number, items } = parsed.data;

  // BR-COL-003: reference_number required for digital methods
  if (payment_method !== "EFECTIVO" && (!reference_number || reference_number.trim().length === 0)) {
    return { success: false, error: "REFERENCE_NUMBER_REQUIRED" };
  }

  // Validate each item against business rules
  let totalCollected = 0;
  const itemPayload: Array<{
    order_id: string;
    invoice_id: string | null;
    amount_applied: number;
  }> = [];

  for (const item of items) {
    const { data: order, error: orderError } = await supabase
      .from("re_orders")
      .select("id, status, seller_id, total")
      .eq("id", item.order_id)
      .single();

    if (orderError || !order) {
      return { success: false, error: "Pedido no encontrado" };
    }

    // BR-COL-001
    if (!["DELIVERED", "PARTIAL"].includes(order.status)) {
      return { success: false, error: "COLLECTION_INVALID_ORDER_STATE" };
    }

    // BR-COL-002
    if (order.seller_id !== user.id) {
      return { success: false, error: "No puedes cobrar pedidos de otro vendedor" };
    }

    // Compute outstanding balance
    const { data: agg } = await supabase
      .from("re_collection_items")
      .select("amount_applied")
      .eq("order_id", order.id);

    const collectedSoFar = (agg ?? []).reduce((s, r) => s + Number(r.amount_applied), 0);
    const outstanding = Number(order.total) - collectedSoFar;

    // BR-COL-010
    if (item.amount_applied > outstanding + 0.001) {
      return { success: false, error: "OVERPAYMENT_NOT_ALLOWED" };
    }

    // BR-COL-009: FIFO fallback for invoice_id
    let invoiceId = item.invoice_id;
    if (!invoiceId) {
      const { data: inv } = await supabase
        .from("re_invoices")
        .select("id")
        .eq("order_id", order.id)
        .order("issue_date", { ascending: true })
        .limit(1)
        .single();
      if (inv) invoiceId = inv.id;
    }

    totalCollected += item.amount_applied;
    itemPayload.push({
      order_id: order.id,
      invoice_id: invoiceId ?? null,
      amount_applied: item.amount_applied,
    });
  }

  // BR-COL-012: total_collected must match sum of items
  const computedTotal = itemPayload.reduce((s, i) => s + i.amount_applied, 0);
  if (Math.abs(computedTotal - totalCollected) > 0.001) {
    return { success: false, error: "Mismatch entre total e ítems" };
  }

  // ATOMIC INSERT via Postgres RPC (BR-COL-015)
  const { data: collectionId, error: rpcError } = await supabase.rpc(
    "re_register_collection",
    {
      p_branch_id: branch_id,
      p_seller_id: user.id,
      p_customer_id: customer_id,
      p_payment_method: payment_method,
      p_reference_number: reference_number ?? null,
      p_total_collected: totalCollected,
      p_items: itemPayload.map((i) => ({
        order_id: i.order_id,
        invoice_id: i.invoice_id,
        amount_applied: i.amount_applied,
      })),
    }
  );

  if (rpcError || !collectionId) {
    return { success: false, error: rpcError?.message || "Error al registrar cobro" };
  }

  revalidatePath("/vendedor/cobranzas");
  return { success: true, message: "Cobro registrado correctamente", collectionId };
}

/* ═══════════════════════════════════════
   2.2 submitDailySettlement
   ═══════════════════════════════════════ */

export async function submitDailySettlement(branchId: string): Promise<SettlementState> {
  const idParse = z.string().uuid().safeParse(branchId);
  if (!idParse.success) {
    return { success: false, error: "Sucursal inválida" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile?.branch_id) {
    return { success: false, error: "Perfil incompleto" };
  }

  if (branchId !== profile.branch_id) {
    return { success: false, error: "Sucursal no autorizada" };
  }

  // Compute Lima date (BR-COL-020)
  const limaDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

  // BR-COL-017: one per (branch, seller, date)
  const { data: existing } = await supabase
    .from("re_daily_settlements")
    .select("id")
    .eq("branch_id", branchId)
    .eq("seller_id", user.id)
    .eq("settlement_date", limaDate)
    .single();

  if (existing) {
    return { success: false, error: "SETTLEMENT_ALREADY_EXISTS" };
  }

  const { error } = await supabase.from("re_daily_settlements").insert({
    branch_id: branchId,
    seller_id: user.id,
    settlement_date: limaDate,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/vendedor/cobranzas");
  return { success: true, message: "Liquidación enviada correctamente" };
}

/* ═══════════════════════════════════════
   2.3 approveSettlement
   ═══════════════════════════════════════ */

export async function approveSettlement(
  settlementId: string,
  totalCollectedPhysical: number | null,
  supervisorNotes: string | null,
  action: "approve" | "discrepancy"
): Promise<SettlementState> {
  const idParse = z.string().uuid().safeParse(settlementId);
  if (!idParse.success) {
    return { success: false, error: "ID de liquidación inválido" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkSupervisorOrAbove(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { data: settlement, error } = await supabase
    .from("re_daily_settlements")
    .select("*")
    .eq("id", settlementId)
    .single();

  if (error || !settlement) {
    return { success: false, error: "Liquidación no encontrada" };
  }

  if (settlement.branch_id !== profile?.branch_id) {
    return { success: false, error: "Sucursal no autorizada" };
  }

  if (settlement.status !== "PENDING") {
    return { success: false, error: "La liquidación ya fue procesada" };
  }

  // BR-COL-025: total_collected_physical is nullable until supervisor evaluates
  if (totalCollectedPhysical === null) {
    return { success: false, error: "Debes ingresar el monto físico contado" };
  }

  const expected = Number(settlement.total_expected);
  const physical = Number(totalCollectedPhysical);
  const hasDiscrepancy = action === "discrepancy" || Math.abs(physical - expected) > 0.001;

  let status: "APPROVED" | "DISCREPANCY" = "APPROVED";
  if (hasDiscrepancy) {
    status = "DISCREPANCY";
    // BR-COL-023: notes mandatory and >= 20 chars
    if (!supervisorNotes || supervisorNotes.trim().length < 20) {
      return { success: false, error: "Debes ingresar una nota de supervisor de al menos 20 caracteres" };
    }
  }

  const { error: updError } = await supabase
    .from("re_daily_settlements")
    .update({
      status,
      total_collected_physical: physical,
      supervisor_notes: supervisorNotes,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", settlementId);

  if (updError) {
    return { success: false, error: updError.message };
  }

  revalidatePath("/admin/cobranzas");
  return { success: true, message: `Liquidación ${status === "APPROVED" ? "aprobada" : "marcada con discrepancia"}` };
}

/* ═══════════════════════════════════════
   2.4 createReversal
   ═══════════════════════════════════════ */

export async function createReversal(
  originalCollectionId: string,
  reason: string
): Promise<CollectionState> {
  const idParse = z.string().uuid().safeParse(originalCollectionId);
  if (!idParse.success) {
    return { success: false, error: "ID de cobro inválido" };
  }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: "El motivo es obligatorio" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);

  if (!profile?.branch_id) {
    return { success: false, error: "Perfil incompleto" };
  }

  const { data: original, error: origError } = await supabase
    .from("re_collections")
    .select("*, re_collection_items(*)")
    .eq("id", originalCollectionId)
    .single();

  if (origError || !original) {
    return { success: false, error: "Cobro original no encontrado" };
  }

  // Find settlement for this collection's date
  const limaDate = new Date(original.collected_at).toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });

  const { data: settlement } = await supabase
    .from("re_daily_settlements")
    .select("status")
    .eq("branch_id", original.branch_id)
    .eq("seller_id", original.seller_id)
    .eq("settlement_date", limaDate)
    .maybeSingle();

  const settlementStatus = settlement?.status as string | undefined;

  // BR-COL-031
  if (settlementStatus === "APPROVED" || settlementStatus === "DISCREPANCY") {
    const adminCheck = checkAdmin(profile.role);
    if (!adminCheck.ok) {
      return { success: false, error: "Solo admin puede reversar liquidaciones cerradas" };
    }
    // Insert audit log
    const { error: auditError } = await supabase.from("re_cancellation_audit_log").insert({
      document_id: original.id,
      document_type: "collection",
      branch_id: original.branch_id,
      user_id: user.id,
      motivo: reason,
    });
    if (auditError) {
      return { success: false, error: auditError.message };
    }
  } else {
    const supCheck = checkSupervisorOrAbove(profile.role);
    if (!supCheck.ok) {
      return { success: false, error: supCheck.error };
    }
  }

  // ATOMIC REVERSAL via Postgres RPC
  const { data: reversalId, error: revError } = await supabase.rpc(
    "re_create_reversal",
    {
      p_original_collection_id: originalCollectionId,
      p_reason: reason,
    }
  );

  if (revError || !reversalId) {
    return { success: false, error: revError?.message || "Error al crear reverso" };
  }

  revalidatePath("/admin/cobranzas");
  return { success: true, message: "Reverso creado correctamente", collectionId: reversalId };
}

/* ═══════════════════════════════════════
   FormData wrappers
   ═══════════════════════════════════════ */

export async function registerCollectionForm(
  _prevState: CollectionState | null,
  formData: FormData
): Promise<CollectionState> {
  const branch_id = formData.get("branch_id") as string;
  const customer_id = formData.get("customer_id") as string;
  const payment_method = formData.get("payment_method") as string;
  const reference_number = (formData.get("reference_number") as string) || null;
  const itemsJson = formData.get("items") as string;

  let items: Array<{ order_id: string; invoice_id?: string | null; amount_applied: number }> = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { success: false, error: "Formato de ítems inválido" };
  }

  return registerCollection({
    branch_id,
    customer_id,
    payment_method: payment_method as any,
    reference_number,
    items,
  });
}

export async function submitDailySettlementForm(
  _prevState: SettlementState | null,
  formData: FormData
): Promise<SettlementState> {
  const branch_id = formData.get("branch_id") as string;
  if (!branch_id) return { success: false, error: "Sucursal requerida" };
  return submitDailySettlement(branch_id);
}

export async function approveSettlementForm(
  _prevState: SettlementState | null,
  formData: FormData
): Promise<SettlementState> {
  const id = formData.get("id") as string;
  const rawPhysical = formData.get("total_collected_physical") as string;
  const total_collected_physical = rawPhysical && rawPhysical.trim() !== "" ? Number(rawPhysical) : null;
  const supervisor_notes = (formData.get("supervisor_notes") as string) || null;
  const action = formData.get("action") as "approve" | "discrepancy";
  if (!id) return { success: false, error: "ID requerido" };
  return approveSettlement(id, total_collected_physical, supervisor_notes, action);
}

export async function createReversalForm(
  _prevState: CollectionState | null,
  formData: FormData
): Promise<CollectionState> {
  const original_collection_id = formData.get("original_collection_id") as string;
  const reason = formData.get("reason") as string;
  if (!original_collection_id || !reason) {
    return { success: false, error: "Cobro original y motivo son requeridos" };
  }
  return createReversal(original_collection_id, reason);
}
