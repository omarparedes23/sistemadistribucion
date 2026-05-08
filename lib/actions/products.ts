"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const productSchema = z.object({
  sku: z.string().min(1, "El SKU es obligatorio").max(50),
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  brand_id: z.string().uuid("Selecciona una marca válida"),
  unit_of_measure: z.string().min(1, "La unidad de medida es obligatoria").max(20),
  weight_kg: z.coerce.number().min(0).optional().nullable(),
  volume_m3: z.coerce.number().min(0).optional().nullable(),
});

export type ProductState =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function createProduct(
  _prevState: ProductState | null,
  formData: FormData
): Promise<ProductState> {
  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    brand_id: formData.get("brand_id"),
    unit_of_measure: formData.get("unit_of_measure"),
    weight_kg: formData.get("weight_kg") || null,
    volume_m3: formData.get("volume_m3") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_products").insert(parsed.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true, message: "Producto creado correctamente" };
}

export async function updateProduct(
  _prevState: ProductState | null,
  formData: FormData
): Promise<ProductState> {
  const id = formData.get("id") as string;
  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    brand_id: formData.get("brand_id"),
    unit_of_measure: formData.get("unit_of_measure"),
    weight_kg: formData.get("weight_kg") || null,
    volume_m3: formData.get("volume_m3") || null,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_products").update(parsed.data).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true, message: "Producto actualizado correctamente" };
}

export async function toggleProductActive(
  _prevState: ProductState | null,
  formData: FormData
): Promise<ProductState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const { error } = await supabase.from("re_products").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/products");
  return { success: true, message: active ? "Producto desactivado" : "Producto activado" };
}
