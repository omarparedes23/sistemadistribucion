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
  if (!["supervisor", "admin"].includes(role ?? "")) {
    return { ok: false, error: "Solo supervisores o administradores pueden realizar esta acción" };
  }
  return { ok: true };
}

async function computeCapacityAdvisory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  manifestId: string
): Promise<string | undefined> {
  const { data: manifest } = await supabase
    .from("re_dispatch_manifests")
    .select("total_weight_kg, total_volume_m3, vehicle_id, re_vehicles(capacity_kg, capacity_m3)")
    .eq("id", manifestId)
    .single();

  if (!manifest || !manifest.vehicle_id) return undefined;

  const warnings: string[] = [];
  type VehicleCapacity = { capacity_kg: number | null; capacity_m3: number | null } | null;
  const vehicle = (manifest as unknown as { re_vehicles: VehicleCapacity }).re_vehicles;

  if (vehicle?.capacity_kg != null && manifest.total_weight_kg > vehicle.capacity_kg) {
    const excess = manifest.total_weight_kg - vehicle.capacity_kg;
    warnings.push(
      `Peso excede capacidad: ${manifest.total_weight_kg} kg > ${vehicle.capacity_kg} kg (exceso: ${excess.toFixed(2)} kg)`
    );
  }

  if (vehicle?.capacity_m3 != null && manifest.total_volume_m3 > vehicle.capacity_m3) {
    const excess = manifest.total_volume_m3 - vehicle.capacity_m3;
    warnings.push(
      `Volumen excede capacidad: ${manifest.total_volume_m3} m³ > ${vehicle.capacity_m3} m³ (exceso: ${excess.toFixed(4)} m³)`
    );
  }

  return warnings.length > 0 ? warnings.join("; ") : undefined;
}

function mapManifestRpcError(code: string): string {
  switch (code) {
    case "INVALID_TRANSITION":
      return "Transición de estado no permitida";
    case "MANIFEST_NOT_FOUND":
      return "Manifiesto no encontrado";
    case "MANIFEST_NOT_DRAFT":
      return "Solo se puede modificar un manifiesto en borrador";
    case "NO_DRIVER_ASSIGNED":
      return "No hay conductor asignado";
    case "MANIFEST_EMPTY":
      return "El manifiesto no tiene pedidos";
    case "MANIFEST_NO_VEHICLE":
      return "No hay vehículo asignado";
    case "GRE_NOT_ACCEPTED":
      return "La guía de remisión no ha sido aceptada por SUNAT";
    case "ORDER_NOT_FOUND":
      return "Pedido no encontrado";
    case "ORDER_NOT_APPROVED":
      return "El pedido no está en estado Aprobado";
    case "ORDER_ALREADY_IN_MANIFEST":
      return "El pedido ya está asignado a otro manifiesto activo";
    case "ORDER_BRANCH_MISMATCH":
      return "El pedido pertenece a otra sucursal";
    case "ORDER_NOT_IN_MANIFEST":
      return "El pedido no está en este manifiesto";
    default:
      return `Error del sistema: ${code}`;
  }
}

/* ─────────────── Schemas ─────────────── */

const createManifestSchema = z.object({
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  warehouse_id: z.string().uuid("Selecciona un almacén válido"),
});

/* ─────────────── Types ─────────────── */

export type ManifestState =
  | { success: true; message?: string; warning?: string; manifestId?: string }
  | { success: false; error: string };

/* ═══════════════════════════════════════
   createManifest
   ═══════════════════════════════════════ */

export async function createManifest(
  _prevState: ManifestState | null,
  formData: FormData
): Promise<ManifestState> {
  const parsed = createManifestSchema.safeParse({
    branch_id: formData.get("branch_id"),
    warehouse_id: formData.get("warehouse_id"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  const { data: manifest, error } = await supabase
    .from("re_dispatch_manifests")
    .insert({
      branch_id: parsed.data.branch_id,
      warehouse_id: parsed.data.warehouse_id,
      vehicle_id: null,
      status: "DRAFT",
      manifest_date: new Date().toISOString().split("T")[0],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !manifest) {
    return { success: false, error: error?.message || "Error al crear el manifiesto" };
  }

  revalidatePath("/admin/manifiestos");
  return { success: true, message: "Manifiesto creado correctamente", manifestId: manifest.id };
}

/* ═══════════════════════════════════════
   confirmManifest
   ═══════════════════════════════════════ */

export async function confirmManifest(manifestId: string): Promise<ManifestState> {
  const idParse = z.string().uuid().safeParse(manifestId);
  if (!idParse.success) {
    return { success: false, error: "ID de manifiesto inválido" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  const { data, error } = await supabase.rpc("re_transition_manifest_status", {
    p_manifest_id: manifestId,
    p_to_state: "CONFIRMED",
    p_user_id: user.id,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("vehicle_already_scheduled")) {
      return { success: false, error: "El vehículo ya está programado para otra ruta este día" };
    }
    return { success: false, error: error.message };
  }

  if (typeof data === "string" && data !== "SUCCESS") {
    return { success: false, error: mapManifestRpcError(data) };
  }

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  return { success: true, message: "Manifiesto confirmado correctamente" };
}

/* ═══════════════════════════════════════
   transitionManifestToEnRoute
   ═══════════════════════════════════════ */

export async function transitionManifestToEnRoute(manifestId: string): Promise<ManifestState> {
  const idParse = z.string().uuid().safeParse(manifestId);
  if (!idParse.success) {
    return { success: false, error: "ID de manifiesto inválido" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  const { data, error } = await supabase.rpc("re_transition_manifest_status", {
    p_manifest_id: manifestId,
    p_to_state: "EN_ROUTE",
    p_user_id: user.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (typeof data === "string" && data !== "SUCCESS") {
    return { success: false, error: mapManifestRpcError(data) };
  }

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  return { success: true, message: "Manifiesto en ruta" };
}

/* ═══════════════════════════════════════
   addOrderToManifest
   ═══════════════════════════════════════ */

export async function addOrderToManifest(
  manifestId: string,
  orderId: string
): Promise<ManifestState> {
  const manifestParse = z.string().uuid().safeParse(manifestId);
  const orderParse = z.string().uuid().safeParse(orderId);
  if (!manifestParse.success || !orderParse.success) {
    return { success: false, error: "IDs inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  const { data, error } = await supabase.rpc("re_manifest_add_order", {
    p_manifest_id: manifestId,
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (typeof data === "string" && data !== "SUCCESS") {
    return { success: false, error: mapManifestRpcError(data) };
  }

  const warning = await computeCapacityAdvisory(supabase, manifestId);

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  revalidatePath("/admin/pedidos");
  return {
    success: true,
    message: "Pedido agregado al manifiesto",
    warning,
  };
}

/* ═══════════════════════════════════════
   removeOrderFromManifest
   ═══════════════════════════════════════ */

export async function removeOrderFromManifest(
  manifestId: string,
  orderId: string
): Promise<ManifestState> {
  const manifestParse = z.string().uuid().safeParse(manifestId);
  const orderParse = z.string().uuid().safeParse(orderId);
  if (!manifestParse.success || !orderParse.success) {
    return { success: false, error: "IDs inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  const { data, error } = await supabase.rpc("re_manifest_remove_order", {
    p_manifest_id: manifestId,
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (typeof data === "string" && data !== "SUCCESS") {
    return { success: false, error: mapManifestRpcError(data) };
  }

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  revalidatePath("/admin/pedidos");
  return { success: true, message: "Pedido removido del manifiesto" };
}

/* ═══════════════════════════════════════
   assignPersonnel
   ═══════════════════════════════════════ */

export async function assignPersonnel(
  manifestId: string,
  personId: string,
  role: "DRIVER" | "ASSISTANT"
): Promise<ManifestState> {
  const manifestParse = z.string().uuid().safeParse(manifestId);
  const personParse = z.string().uuid().safeParse(personId);
  if (!manifestParse.success || !personParse.success) {
    return { success: false, error: "IDs inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  // Guard: manifest must be DRAFT
  const { data: manifest } = await supabase
    .from("re_dispatch_manifests")
    .select("status")
    .eq("id", manifestId)
    .single();

  if (manifest?.status !== "DRAFT") {
    return { success: false, error: "Solo se puede modificar un manifiesto en borrador" };
  }

  // Guard: exactly one DRIVER
  if (role === "DRIVER") {
    const { data: existingDriver } = await supabase
      .from("re_manifest_personnel")
      .select("person_id")
      .eq("manifest_id", manifestId)
      .eq("role", "DRIVER")
      .single();

    if (existingDriver) {
      return { success: false, error: "Ya existe un conductor asignado a este manifiesto" };
    }
  }

  const { error } = await supabase.from("re_manifest_personnel").insert({
    manifest_id: manifestId,
    person_id: personId,
    role,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  return { success: true, message: "Personal asignado correctamente" };
}

/* ═══════════════════════════════════════
   removePersonnel
   ═══════════════════════════════════════ */

export async function removePersonnel(
  manifestId: string,
  personId: string
): Promise<ManifestState> {
  const manifestParse = z.string().uuid().safeParse(manifestId);
  const personParse = z.string().uuid().safeParse(personId);
  if (!manifestParse.success || !personParse.success) {
    return { success: false, error: "IDs inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  // Guard: manifest must be DRAFT
  const { data: manifest } = await supabase
    .from("re_dispatch_manifests")
    .select("status")
    .eq("id", manifestId)
    .single();

  if (manifest?.status !== "DRAFT") {
    return { success: false, error: "Solo se puede modificar un manifiesto en borrador" };
  }

  const { error } = await supabase
    .from("re_manifest_personnel")
    .delete()
    .eq("manifest_id", manifestId)
    .eq("person_id", personId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  return { success: true, message: "Personal removido correctamente" };
}

/* ═══════════════════════════════════════
   assignVehicle
   ═══════════════════════════════════════ */

export async function assignVehicle(
  manifestId: string,
  vehicleId: string
): Promise<ManifestState> {
  const manifestParse = z.string().uuid().safeParse(manifestId);
  const vehicleParse = z.string().uuid().safeParse(vehicleId);
  if (!manifestParse.success || !vehicleParse.success) {
    return { success: false, error: "IDs inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const roleCheck = checkSupervisorOrAbove(profile?.role);
  if (!roleCheck.ok) {
    return { success: false, error: roleCheck.error };
  }

  // Guard: manifest must be DRAFT
  const { data: manifest } = await supabase
    .from("re_dispatch_manifests")
    .select("status")
    .eq("id", manifestId)
    .single();

  if (manifest?.status !== "DRAFT") {
    return { success: false, error: "Solo se puede modificar un manifiesto en borrador" };
  }

  const { error } = await supabase
    .from("re_dispatch_manifests")
    .update({ vehicle_id: vehicleId })
    .eq("id", manifestId);

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("vehicle_already_scheduled")) {
      return { success: false, error: "El vehículo ya está programado para otra ruta este día" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/manifiestos");
  revalidatePath(`/admin/manifiestos/${manifestId}`);
  return { success: true, message: "Vehículo asignado correctamente" };
}
