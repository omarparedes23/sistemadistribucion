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

/* ─────────────── Types ─────────────── */

export type InvoiceState =
  | { success: true; message?: string; invoiceId?: string; creditNoteId?: string }
  | { success: false; error: string };

/* ═══════════════════════════════════════
   2.5 generateInvoice
   ═══════════════════════════════════════ */

export async function generateInvoice(
  orderId: string,
  docType: "FACTURA" | "BOLETA" = "FACTURA"
): Promise<InvoiceState> {
  const parsed = z
    .object({
      orderId: z.string().uuid("ID de pedido inválido"),
      docType: z.enum(["FACTURA", "BOLETA"]),
    })
    .safeParse({ orderId, docType });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase.rpc("re_generate_invoice", {
    p_order_id: parsed.data.orderId,
    p_user_id: user.id,
    p_doc_type: parsed.data.docType,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/invoices");
  return {
    success: true,
    message: "Comprobante generado correctamente",
    invoiceId: typeof data === "string" ? data : undefined,
  };
}

/* ═══════════════════════════════════════
   2.5 generateCreditNote
   ═══════════════════════════════════════ */

export async function generateCreditNote(
  invoiceId: string,
  reason: string
): Promise<InvoiceState> {
  const parsed = z
    .object({
      invoiceId: z.string().uuid("ID de comprobante inválido"),
      reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
    })
    .safeParse({ invoiceId, reason });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  const { data, error } = await supabase.rpc("re_generate_credit_note", {
    p_invoice_id: parsed.data.invoiceId,
    p_user_id: user.id,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/invoices");
  return {
    success: true,
    message: "Nota de crédito generada correctamente",
    creditNoteId: typeof data === "string" ? data : undefined,
  };
}
