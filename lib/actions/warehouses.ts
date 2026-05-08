"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const warehouseSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
});

export type WarehouseState =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function createWarehouse(
  _prevState: WarehouseState | null,
  formData: FormData
): Promise<WarehouseState> {
  const parsed = warehouseSchema.safeParse({
    name: formData.get("name"),
    branch_id: formData.get("branch_id"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_warehouses").insert(parsed.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/warehouses");
  return { success: true, message: "Almacén creado correctamente" };
}

export async function updateWarehouse(
  _prevState: WarehouseState | null,
  formData: FormData
): Promise<WarehouseState> {
  const id = formData.get("id") as string;
  const parsed = warehouseSchema.safeParse({
    name: formData.get("name"),
    branch_id: formData.get("branch_id"),
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("re_warehouses").update(parsed.data).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/warehouses");
  return { success: true, message: "Almacén actualizado correctamente" };
}

export async function toggleWarehouseActive(
  _prevState: WarehouseState | null,
  formData: FormData
): Promise<WarehouseState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const { error } = await supabase.from("re_warehouses").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/warehouses");
  return { success: true, message: active ? "Almacén desactivado" : "Almacén activado" };
}
