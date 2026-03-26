import { z } from 'zod';

// ─── Response: seller con datos de contacto (JOIN) ───────────────────────────

export const SellerSchema = z.object({
  id_seller: z.number().int(),
  id_contact: z.number().int(),
  seller_code: z.string().nullable(),
  is_active: z.boolean(),
  contact_name: z.string().nullable(),
  identification: z.string().nullable(),
  company_name: z.string().nullable(),
  phone_mobile: z.string().nullable(),
  email: z.string().nullable(),
  address_billing_line: z.string().nullable(),
  address_billing_region: z.string().nullable(),
  address_billing_city: z.string().nullable(),
  is_customer: z.boolean().nullable(),
  is_supplier: z.boolean().nullable(),
  is_employee: z.boolean().nullable(),
  is_in_external_software: z.boolean().nullable(),
  is_prospect: z.boolean().nullable(),
  is_excluded: z.boolean().nullable(),
  is_blacklisted: z.boolean().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

// ─── Query params ─────────────────────────────────────────────────────────────

export const SellersListQuery = z.object({
  ref: z.string().min(1),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().optional(),
  is_active: z.enum(['true', 'false']).optional(),
});

export const SellerByIdQuery = z.object({
  ref: z.string().min(1),
});

export const SellerDeleteQuery = z.object({
  ref: z.string().min(1),
  deleted_by_user_id: z.string().regex(/^\d+$/).optional(),
});

// ─── Path params ──────────────────────────────────────────────────────────────

export const SellerIdParam = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a positive integer'),
});

// ─── Body: create ─────────────────────────────────────────────────────────────

export const CreateSellerBody = z.object({
  contact_name: z.string().min(1),
  identification: z.string().optional(),
  company_name: z.string().optional(),
  phone_mobile: z.string().optional(),
  email: z.string().optional(),
  seller_code: z.string().optional(),
  is_active: z.boolean().optional(),
  address_billing_line: z.string().optional(),
  address_billing_region: z.string().optional(),
  address_billing_city: z.string().optional(),
  is_customer: z.boolean().optional(),
  is_supplier: z.boolean().optional(),
  is_employee: z.boolean().optional(),
  is_in_external_software: z.boolean().optional(),
  created_by_user_id: z.number().int().optional(),
});

// ─── Body: update ─────────────────────────────────────────────────────────────

export const UpdateSellerBody = z.object({
  contact_name: z.string().min(1).optional(),
  identification: z.string().optional(),
  company_name: z.string().optional(),
  phone_mobile: z.string().optional(),
  email: z.string().optional(),
  seller_code: z.string().optional(),
  is_active: z.boolean().optional(),
  address_billing_line: z.string().optional(),
  address_billing_region: z.string().optional(),
  address_billing_city: z.string().optional(),
  is_customer: z.boolean().optional(),
  is_supplier: z.boolean().optional(),
  is_employee: z.boolean().optional(),
  is_in_external_software: z.boolean().optional(),
  updated_by_user_id: z.number().int().optional(),
});

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type CreateSellerInput = z.infer<typeof CreateSellerBody>;
export type UpdateSellerInput = z.infer<typeof UpdateSellerBody>;
