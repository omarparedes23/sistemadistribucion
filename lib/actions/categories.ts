"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const categorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().max(255).optional().nullable(),
});

export type CategoryState =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function createCategory(
  _prevState: CategoryState | null,
  formData: FormData
): Promise<CategoryState> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_categories").insert(parsed.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  return { success: true, message: "Categoría creada correctamente" };
}

export async function updateCategory(
  _prevState: CategoryState | null,
  formData: FormData
): Promise<CategoryState> {
  const id = formData.get("id") as string;
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("re_categories")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  return { success: true, message: "Categoría actualizada correctamente" };
}

export async function toggleCategoryActive(
  _prevState: CategoryState | null,
  formData: FormData
): Promise<CategoryState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) {
    return { success: false, error: "ID requerido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("re_categories")
    .update({ active: !active })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  return { success: true, message: active ? "Categoría desactivada" : "Categoría activada" };
}
