"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const branchSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  region: z.string().min(1, "La región es obligatoria").max(100),
  address: z.string().max(255).optional().nullable(),
  gre_serie: z.string().max(10).optional().nullable(),
  factura_serie: z.string().max(10).optional().nullable(),
  boleta_serie: z.string().max(10).optional().nullable(),
});

export type BranchState =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function createBranch(
  _prevState: BranchState | null,
  formData: FormData
): Promise<BranchState> {
  const supabase = await createClient();

  // Single company assumption: pick the first company
  const { data: company } = await supabase
    .from("re_companies")
    .select("id")
    .limit(1)
    .single();

  if (!company) {
    return { success: false, error: "No existe una empresa registrada. Crea una empresa primero." };
  }

  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    region: formData.get("region"),
    address: formData.get("address") || null,
    gre_serie: formData.get("gre_serie") || null,
    factura_serie: formData.get("factura_serie") || null,
    boleta_serie: formData.get("boleta_serie") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const { error } = await supabase
    .from("re_branches")
    .insert({ ...parsed.data, company_id: company.id });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/branches");
  return { success: true, message: "Sucursal creada correctamente" };
}

export async function updateBranch(
  _prevState: BranchState | null,
  formData: FormData
): Promise<BranchState> {
  const id = formData.get("id") as string;
  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    region: formData.get("region"),
    address: formData.get("address") || null,
    gre_serie: formData.get("gre_serie") || null,
    factura_serie: formData.get("factura_serie") || null,
    boleta_serie: formData.get("boleta_serie") || null,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_branches").update(parsed.data).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/branches");
  return { success: true, message: "Sucursal actualizada correctamente" };
}

export async function toggleBranchActive(
  _prevState: BranchState | null,
  formData: FormData
): Promise<BranchState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const { error } = await supabase.from("re_branches").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/branches");
  return { success: true, message: active ? "Sucursal desactivada" : "Sucursal activada" };
}
