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
  // Identificación
  id_contact:               z.number().int().describe('ID único del contacto'),
  contact_name:             z.string().nullable().describe('Nombre completo del contacto'),
  identification:           z.string().nullable().describe('Número de identificación (cédula, NIT, etc.)'),
  company_name:             z.string().nullable().describe('Nombre de la empresa'),
  phone_mobile:             z.string().nullable().describe('Teléfono móvil'),
  email:                    z.string().nullable().describe('Correo electrónico'),
  // Flags de tipo
  is_seller:                z.boolean().nullable().describe('Es vendedor'),
  is_customer:              z.boolean().nullable().describe('Es cliente'),
  is_supplier:              z.boolean().nullable().describe('Es proveedor'),
  is_employee:              z.boolean().nullable().describe('Es empleado'),
  is_in_external_software:  z.boolean().nullable().describe('Está sincronizado con software externo'),
  is_prospect:              z.boolean().nullable().describe('Es prospecto'),
  is_in_my_followups:       z.boolean().nullable().describe('Está en seguimiento personal'),
  is_in_reassigned:         z.boolean().nullable().describe('Fue reasignado'),
  is_excluded:              z.boolean().nullable().describe('Está excluido'),
  is_blacklisted:           z.boolean().nullable().describe('Está en lista negra'),
  // Dirección
  address_billing_line:     z.string().nullable().describe('Dirección de facturación'),
  address_billing_region:   z.string().nullable().describe('Región / Departamento de facturación'),
  address_billing_city:     z.string().nullable().describe('Ciudad de facturación'),
  // Referencias a estados
  id_seller:                z.number().nullable().describe('ID del vendedor responsable de este contacto'),
  id_status_customer:       z.number().nullable().describe('ID del estado como cliente'),
  id_status_prospect:       z.number().nullable().describe('ID del estado como prospecto'),
  id_status_supplier:       z.number().nullable().describe('ID del estado como proveedor'),
  id_status_employee:       z.number().nullable().describe('ID del estado como empleado'),
  id_status_seller:         z.number().nullable().describe('ID del estado como vendedor'),
  // Datos del vendedor (solo cuando is_seller = true)
  seller_id:                z.number().nullable().describe('ID del registro en la tabla sellers'),
  seller_code:              z.string().nullable().describe('Código interno del vendedor'),
  seller_is_active:         z.boolean().nullable().describe('El vendedor está activo'),
  // Auditoría
  created_at:               z.string().nullable().describe('Fecha de creación'),
  created_by_user_id:       z.number().nullable().describe('ID del usuario que creó el registro'),
  updated_at:               z.string().nullable().describe('Fecha de última actualización'),
  updated_by_user_id:       z.number().nullable().describe('ID del usuario que actualizó el registro'),
});

// ─── Query params: lista ──────────────────────────────────────────────────────

export const ContactsListQuery = z.object({
  ref:    z.string().min(1).describe('Referencia del tenant en Supabase'),
  page:   z.string().regex(/^\d+$/).optional().describe('Número de página (default: 1)'),
  limit:  z.string().regex(/^\d+$/).optional().describe('Registros por página, máximo 100 (default: 20)'),
  search: z.string().optional().describe('Búsqueda por nombre, identificación, email o empresa'),
  type:   ContactTypeEnum.optional().describe('Filtrar por tipo: seller | customer | supplier | employee | prospect'),
});

export const ContactByIdQuery = z.object({
  ref: z.string().min(1).describe('Referencia del tenant en Supabase'),
});

export const ContactDeleteQuery = z.object({
  ref:                 z.string().min(1).describe('Referencia del tenant en Supabase'),
  deleted_by_user_id:  z.string().regex(/^\d+$/).optional().describe('ID del usuario que realiza la eliminación'),
});

// ─── Path params ──────────────────────────────────────────────────────────────

export const ContactIdParam = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a positive integer').describe('ID del contacto'),
});

// ─── Body: create ─────────────────────────────────────────────────────────────

export const CreateContactBody = z.object({
  // Datos principales
  contact_name:             z.string().min(1).describe('Nombre completo del contacto (requerido)'),
  identification:           z.string().optional().describe('Número de identificación'),
  company_name:             z.string().optional().describe('Nombre de la empresa'),
  phone_mobile:             z.string().optional().describe('Teléfono móvil'),
  email:                    z.string().optional().describe('Correo electrónico'),
  // Flags de tipo — al menos uno debería ser true
  is_seller:                z.boolean().optional().describe('Es vendedor. Si es true, crea automáticamente el registro en la tabla sellers'),
  is_customer:              z.boolean().optional().describe('Es cliente'),
  is_supplier:              z.boolean().optional().describe('Es proveedor'),
  is_employee:              z.boolean().optional().describe('Es empleado'),
  is_in_external_software:  z.boolean().optional().describe('Sincronizado con software externo'),
  is_prospect:              z.boolean().optional().describe('Es prospecto'),
  // Dirección
  address_billing_line:     z.string().optional().describe('Dirección de facturación'),
  address_billing_region:   z.string().optional().describe('Región / Departamento'),
  address_billing_city:     z.string().optional().describe('Ciudad'),
  // Estados
  id_status_customer:       z.number().int().optional().describe('ID del estado como cliente'),
  id_status_prospect:       z.number().int().optional().describe('ID del estado como prospecto'),
  id_status_supplier:       z.number().int().optional().describe('ID del estado como proveedor'),
  id_status_employee:       z.number().int().optional().describe('ID del estado como empleado'),
  id_status_seller:         z.number().int().optional().describe('ID del estado como vendedor'),
  // Solo cuando is_seller = true
  seller_code:              z.string().optional().describe('Código del vendedor (solo aplica si is_seller = true)'),
  seller_is_active:         z.boolean().optional().describe('Vendedor activo (solo aplica si is_seller = true, default: true)'),
  // Auditoría
  created_by_user_id:       z.number().int().optional().describe('ID del usuario que crea el registro'),
});

// ─── Body: update ─────────────────────────────────────────────────────────────

export const UpdateContactBody = z.object({
  // Datos principales
  contact_name:             z.string().min(1).optional().describe('Nombre completo'),
  identification:           z.string().optional().describe('Número de identificación'),
  company_name:             z.string().optional().describe('Nombre de la empresa'),
  phone_mobile:             z.string().optional().describe('Teléfono móvil'),
  email:                    z.string().optional().describe('Correo electrónico'),
  // Flags de tipo
  is_seller:                z.boolean().optional().describe('Es vendedor. Si cambia a true y no tenía registro en sellers, lo crea automáticamente'),
  is_customer:              z.boolean().optional().describe('Es cliente'),
  is_supplier:              z.boolean().optional().describe('Es proveedor'),
  is_employee:              z.boolean().optional().describe('Es empleado'),
  is_in_external_software:  z.boolean().optional().describe('Sincronizado con software externo'),
  is_prospect:              z.boolean().optional().describe('Es prospecto'),
  is_in_my_followups:       z.boolean().optional().describe('En seguimiento personal'),
  is_in_reassigned:         z.boolean().optional().describe('Fue reasignado'),
  is_excluded:              z.boolean().optional().describe('Excluido'),
  is_blacklisted:           z.boolean().optional().describe('En lista negra'),
  // Dirección
  address_billing_line:     z.string().optional().describe('Dirección de facturación'),
  address_billing_region:   z.string().optional().describe('Región / Departamento'),
  address_billing_city:     z.string().optional().describe('Ciudad'),
  // Estados
  id_status_customer:       z.number().int().optional().describe('ID del estado como cliente'),
  id_status_prospect:       z.number().int().optional().describe('ID del estado como prospecto'),
  id_status_supplier:       z.number().int().optional().describe('ID del estado como proveedor'),
  id_status_employee:       z.number().int().optional().describe('ID del estado como empleado'),
  id_status_seller:         z.number().int().optional().describe('ID del estado como vendedor'),
  // Campos de vendedor
  seller_code:              z.string().optional().describe('Código del vendedor'),
  seller_is_active:         z.boolean().optional().describe('Vendedor activo'),
  // Auditoría
  updated_by_user_id:       z.number().int().optional().describe('ID del usuario que actualiza'),
});

// ─── Tipos inferidos ──────────────────────────────────────────────────────────

export type CreateContactInput = z.infer<typeof CreateContactBody>;
export type UpdateContactInput = z.infer<typeof UpdateContactBody>;
export type ContactType = z.infer<typeof ContactTypeEnum>;
