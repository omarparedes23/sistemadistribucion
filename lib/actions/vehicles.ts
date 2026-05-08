"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const vehicleSchema = z.object({
  plate_number: z.string().min(1, "La placa es obligatoria").max(20),
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  capacity_kg: z.coerce.number().min(0).optional().nullable(),
  capacity_m3: z.coerce.number().min(0).optional().nullable(),
});

export type VehicleState =
  | { success: true; message?: string }
  | { success: false; error: string };

type AdminCheckResult =
  | { ok: false; error: string }
  | { ok: true; user: { id: string } };

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AdminCheckResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("re_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false, error: "Solo administradores pueden realizar esta acción" };
  }
  return { ok: true, user };
}

export async function createVehicle(
  _prevState: VehicleState | null,
  formData: FormData
): Promise<VehicleState> {
  const parsed = vehicleSchema.safeParse({
    plate_number: formData.get("plate_number"),
    branch_id: formData.get("branch_id"),
    capacity_kg: formData.get("capacity_kg") || null,
    capacity_m3: formData.get("capacity_m3") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const adminCheck = await checkAdmin(supabase);
  if (!adminCheck.ok) {
    return { success: false, error: adminCheck.error };
  }

  const { error } = await supabase.from("re_vehicles").insert(parsed.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/vehiculos");
  return { success: true, message: "Vehículo creado correctamente" };
}

export async function updateVehicle(
  _prevState: VehicleState | null,
  formData: FormData
): Promise<VehicleState> {
  const id = formData.get("id") as string;
  const parsed = vehicleSchema.safeParse({
    plate_number: formData.get("plate_number"),
    branch_id: formData.get("branch_id"),
    capacity_kg: formData.get("capacity_kg") || null,
    capacity_m3: formData.get("capacity_m3") || null,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const adminCheck = await checkAdmin(supabase);
  if (!adminCheck.ok) {
    return { success: false, error: adminCheck.error };
  }

  const { error } = await supabase.from("re_vehicles").update(parsed.data).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/vehiculos");
  return { success: true, message: "Vehículo actualizado correctamente" };
}

export async function toggleVehicleActive(
  _prevState: VehicleState | null,
  formData: FormData
): Promise<VehicleState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const adminCheck = await checkAdmin(supabase);
  if (!adminCheck.ok) {
    return { success: false, error: adminCheck.error };
  }

  const { error } = await supabase.from("re_vehicles").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/vehiculos");
  return { success: true, message: active ? "Vehículo desactivado" : "Vehículo activado" };
}
