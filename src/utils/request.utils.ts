import type { Context } from 'hono';
import type { Pool } from 'pg';
import { z } from 'zod';
import { getDb } from '../config/db';

// ─── Schema de ID compartido ──────────────────────────────────────────────────

/**
 * Schema centralizado para validar el parámetro `:id` en rutas.
 * Evita redefinirlo en cada controller.
 */
export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a positive integer'),
});

// ─── Resolución de BD multi-tenant ────────────────────────────────────────────

export type DbResolutionOk = { kind: 'ok'; db: Pool };
export type DbResolutionError = {
  kind: 'error';
  status: 400;
  body: { success: false; error: string; message?: string };
};
export type DbResolution = DbResolutionOk | DbResolutionError;

/**
 * Resuelve el pool de BD a partir del parámetro `?ref=` del request.
 * - Retorna `kind: 'error'` con status 400 si `ref` no está presente.
 * - Retorna `kind: 'error'` con status 404 si en producción sin `ENABLE_DB_REF=true`.
 * - Retorna `kind: 'ok'` con el pool de conexión si todo es correcto.
 *
 * Uso en controllers:
 * ```ts
 * const resolved = resolveDb(c);
 * if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
 * const { db } = resolved;
 * ```
 */
export function resolveDb(c: Context): DbResolution {
  const ref = c.req.query('ref')?.trim();

  if (!ref) {
    return {
      kind: 'error',
      status: 400,
      body: { success: false, error: 'Bad Request', message: 'ref query parameter is required' },
    };
  }

  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DB_REF !== 'true') {
    return {
      kind: 'error',
      status: 400 as const,
      body: { success: false, error: 'Bad Request', message: 'Database access not enabled' },
    };
  }

  return { kind: 'ok', db: getDb(ref) };
}

// ─── Helper de paginación ─────────────────────────────────────────────────────

/**
 * Construye el objeto de respuesta paginada estándar.
 * Centraliza la lógica de cálculo de páginas y evita duplicación.
 */
export function buildPaginatedResponse(
  data: any[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    data_items: total,
    page_current: page,
    page_total: totalPages,
    have_next_page: page < totalPages,
    have_previous_page: page > 1,
  };
}
