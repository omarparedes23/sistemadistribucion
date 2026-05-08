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

function checkAdminOrSupervisor(role: string | undefined): { ok: true } | { ok: false; error: string } {
  if (!role || !["admin", "supervisor"].includes(role)) {
    return { ok: false, error: "Solo admin o supervisor pueden realizar esta acción" };
  }
  return { ok: true };
}

export type CustomerState =
  | { success: true; message?: string }
  | { success: false; error: string };

export type CustomerAddressState = CustomerState;

/* ─────────────── Schemas ─────────────── */

const customerSchema = z.object({
  branch_id: z.string().uuid("Selecciona una sucursal válida"),
  ruc_or_dni: z.string().min(1, "El RUC o DNI es obligatorio").max(20),
  legal_name: z.string().min(1, "La razón social es obligatoria").max(150),
  trade_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  credit_limit: z.coerce.number().min(0).optional().nullable(),
  active: z.coerce.boolean().optional(),
});

const customerAddressSchema = z.object({
  customer_id: z.string().uuid("Selecciona un cliente válido"),
  address_line: z.string().min(1, "La dirección es obligatoria").max(255),
  district: z.string().min(1, "El distrito es obligatorio").max(100),
  province: z.string().min(1, "La provincia es obligatoria").max(100),
  department: z.string().min(1, "El departamento es obligatorio").max(100),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  is_primary: z.coerce.boolean(),
});

/* ─────────────── Customer Actions ─────────────── */

export async function createCustomer(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const parsed = customerSchema.safeParse({
    branch_id: formData.get("branch_id"),
    ruc_or_dni: formData.get("ruc_or_dni"),
    legal_name: formData.get("legal_name"),
    trade_name: formData.get("trade_name") || null,
    phone: formData.get("phone") || null,
    credit_limit: formData.get("credit_limit") || null,
    active: formData.get("active") ?? true,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customers").insert(parsed.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/customers");
  return { success: true, message: "Cliente creado correctamente" };
}

export async function updateCustomer(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const id = formData.get("id") as string;
  const parsed = customerSchema.safeParse({
    branch_id: formData.get("branch_id"),
    ruc_or_dni: formData.get("ruc_or_dni"),
    legal_name: formData.get("legal_name"),
    trade_name: formData.get("trade_name") || null,
    phone: formData.get("phone") || null,
    credit_limit: formData.get("credit_limit") || null,
    active: formData.get("active") ?? true,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customers").update(parsed.data).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/customers");
  return { success: true, message: "Cliente actualizado correctamente" };
}

export async function deleteCustomer(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customers").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/customers");
  return { success: true, message: "Cliente eliminado correctamente" };
}

export async function toggleCustomerActive(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customers").update({ active: !active }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/customers");
  return { success: true, message: active ? "Cliente desactivado" : "Cliente activado" };
}

/* ─────────────── Customer Address Actions ─────────────── */

export async function createCustomerAddress(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const parsed = customerAddressSchema.safeParse({
    customer_id: formData.get("customer_id"),
    address_line: formData.get("address_line"),
    district: formData.get("district"),
    province: formData.get("province"),
    department: formData.get("department"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    is_primary: formData.get("is_primary") ?? false,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { latitude, longitude, ...rest } = parsed.data;
  const coordinates = `SRID=4326;POINT(${longitude} ${latitude})`;

  const { error } = await supabase.from("re_customer_addresses").insert({
    ...rest,
    coordinates,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/customers");
  return { success: true, message: "Dirección creada correctamente" };
}

export async function updateCustomerAddress(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const id = formData.get("id") as string;
  const parsed = customerAddressSchema.safeParse({
    customer_id: formData.get("customer_id"),
    address_line: formData.get("address_line"),
    district: formData.get("district"),
    province: formData.get("province"),
    department: formData.get("department"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    is_primary: formData.get("is_primary") ?? false,
  });

  if (!parsed.success || !id) {
    return { success: false, error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { latitude, longitude, ...rest } = parsed.data;
  const coordinates = `SRID=4326;POINT(${longitude} ${latitude})`;

  const { error } = await supabase.from("re_customer_addresses").update({
    ...rest,
    coordinates,
  }).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/customers");
  return { success: true, message: "Dirección actualizada correctamente" };
}

export async function deleteCustomerAddress(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customer_addresses").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/customers");
  return { success: true, message: "Dirección eliminada correctamente" };
}

export async function togglePrimaryAddress(
  _prevState: CustomerState | null,
  formData: FormData
): Promise<CustomerState> {
  const id = formData.get("id") as string;
  const is_primary = formData.get("is_primary") === "true";

  if (!id) return { success: false, error: "ID requerido" };

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  const profile = await getUserRole(supabase, user.id);
  const auth = checkAdminOrSupervisor(profile?.role);
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await supabase.from("re_customer_addresses").update({ is_primary: !is_primary }).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/customers");
  return { success: true, message: is_primary ? "Dirección marcada como secundaria" : "Dirección marcada como principal" };
}
