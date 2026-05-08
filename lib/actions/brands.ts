"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const brandSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  category_id: z.string().uuid("Selecciona una categoría válida"),
});

export type BrandState =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function createBrand(
  _prevState: BrandState | null,
  formData: FormData
): Promise<BrandState> {
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_brands").insert(parsed.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/brands");
  return { success: true, message: "Marca creada correctamente" };
}

export async function updateBrand(
  _prevState: BrandState | null,
  formData: FormData
): Promise<BrandState> {
  const id = formData.get("id") as string;
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_brands").update(parsed.data).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/brands");
  return { success: true, message: "Marca actualizada correctamente" };
}

export async function toggleBrandActive(
  _prevState: BrandState | null,
  formData: FormData
): Promise<BrandState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const { error } = await supabase.from("re_brands").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/brands");
  return { success: true, message: active ? "Marca desactivada" : "Marca activada" };
}
