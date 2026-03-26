import { z } from 'zod';

// ─── Tipos de contacto para filtrar ──────────────────────────────────────────

export const ContactTypeEnum = z.enum([
  'seller',
  'customer',
  'supplier',
  'employee',
  'prospect',
]);

// ─── Response: contacto completo (con datos de seller si aplica) ──────────────

export const ContactSchema = z.object({
  id_contact: z.number().int(),
  contact_name: z.string().nullable(),
  identification: z.string().nullable(),
  company_name: z.string().nullable(),
  phone_mobile: z.string().nullable(),
  email: z.string().nullable(),
  // Flags de tipo
  is_seller: z.boolean().nullable(),
  is_customer: z.boolean().nullable(),
  is_supplier: z.boolean().nullable(),
  is_employee: z.boolean().nullable(),
  is_in_external_software: z.boolean().nullable(),
  is_prospect: z.boolean().nullable(),
  is_in_my_followups: z.boolean().nullable(),
  is_in_reassigned: z.boolean().nullable(),
  is_excluded: z.boolean().nullable(),
  is_blacklisted: z.boolean().nullable(),
  // Dirección
  address_billing_line: z.string().nullable(),
  address_billing_region: z.string().nullable(),
  address_billing_city: z.string().nullable(),
  // Referencias
  id_seller: z.number().nullable(),
  id_status_customer: z.number().nullable(),
  id_status_prospect: z.number().nullable(),
  id_status_supplier: z.number().nullable(),
  id_status_employee: z.number().nullable(),
  id_status_seller: z.number().nullable(),
  // Datos del vendedor (solo cuando is_seller = true)
  seller_id: z.number().nullable(),
  seller_code: z.string().nullable(),
  seller_is_active: z.boolean().nullable(),
  // Auditoría
  created_at: z.string().nullable(),
  created_by_user_id: z.number().nullable(),
  updated_at: z.string().nullable(),
  updated_by_user_id: z.number().nullable(),
});

// ─── Query params: lista ──────────────────────────────────────────────────────

export const ContactsListQuery = z.object({
  ref: z.string().min(1),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().optional(),
  type: ContactTypeEnum.optional(),
});

export const ContactByIdQuery = z.object({
  ref: z.string().min(1),
});

export const ContactDeleteQuery = z.object({
  ref: z.string().min(1),
  deleted_by_user_id: z.string().regex(/^\d+$/).optional(),
});

// ─── Path params ──────────────────────────────────────────────────────────────

export const ContactIdParam = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a positive integer'),
});

// ─── Body: create ─────────────────────────────────────────────────────────────

export const CreateContactBody = z.object({
  contact_name: z.string().min(1),
  identification: z.string().optional(),
  company_name: z.string().optional(),
  phone_mobile: z.string().optional(),
  email: z.string().optional(),
  // Flags de tipo — al menos uno debería ser true en la práctica
  is_seller: z.boolean().optional(),
  is_customer: z.boolean().optional(),
  is_supplier: z.boolean().optional(),
  is_employee: z.boolean().optional(),
  is_in_external_software: z.boolean().optional(),
  is_prospect: z.boolean().optional(),
  // Dirección
  address_billing_line: z.string().optional(),
  address_billing_region: z.string().optional(),
  address_billing_city: z.string().optional(),
  // Estados
  id_status_customer: z.number().int().optional(),
  id_status_prospect: z.number().int().optional(),
  id_status_supplier: z.number().int().optional(),
  id_status_employee: z.number().int().optional(),
  id_status_seller: z.number().int().optional(),
  // Campos solo cuando is_seller = true
  seller_code: z.string().optional(),
  seller_is_active: z.boolean().optional(),
  // Auditoría
  created_by_user_id: z.number().int().optional(),
});

// ─── Body: update ─────────────────────────────────────────────────────────────

export const UpdateContactBody = z.object({
  contact_name: z.string().min(1).optional(),
  identification: z.string().optional(),
  company_name: z.string().optional(),
  phone_mobile: z.string().optional(),
  email: z.string().optional(),
  // Flags de tipo
  is_seller: z.boolean().optional(),
  is_customer: z.boolean().optional(),
  is_supplier: z.boolean().optional(),
  is_employee: z.boolean().optional(),
  is_in_external_software: z.boolean().optional(),
  is_prospect: z.boolean().optional(),
  is_in_my_followups: z.boolean().optional(),
  is_in_reassigned: z.boolean().optional(),
  is_excluded: z.boolean().optional(),
  is_blacklisted: z.boolean().optional(),
  // Dirección
  address_billing_line: z.string().optional(),
  address_billing_region: z.string().optional(),
  address_billing_city: z.string().optional(),
  // Estados
  id_status_customer: z.number().int().optional(),
  id_status_prospect: z.number().int().optional(),
  id_status_supplier: z.number().int().optional(),
  id_status_employee: z.number().int().optional(),
  id_status_seller: z.number().int().optional(),
  // Campos de vendedor (si aplica)
  seller_code: z.string().optional(),
  seller_is_active: z.boolean().optional(),
  // Auditoría
  updated_by_user_id: z.number().int().optional(),
});

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type CreateContactInput = z.infer<typeof CreateContactBody>;
export type UpdateContactInput = z.infer<typeof UpdateContactBody>;
export type ContactType = z.infer<typeof ContactTypeEnum>;
