import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { resolveDb, buildPaginatedResponse } from '../utils/request.utils';
import { NotFoundError } from '../utils/errors';
import {
  SellersListQuery,
  SellerByIdQuery,
  SellerDeleteQuery,
  SellerIdParam,
  CreateSellerBody,
  UpdateSellerBody,
} from '../schemas/sellers.schemas';
import {
  getSellers,
  getSellerById,
  createSeller,
  updateSeller,
  deleteSeller,
} from '../services/sellers.service';

const router = new OpenAPIHono();

// ─── Schemas de respuesta locales ─────────────────────────────────────────────

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  message: z.string().optional(),
});

// ─── GET /sellers ─────────────────────────────────────────────────────────────

const getListRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Sellers'],
  summary: 'Obtener lista de vendedores',
  description: 'Retorna la lista paginada de contactos vendedores. Filtros: search, is_active.',
  request: {
    query: SellersListQuery,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.record(z.string(), z.unknown())),
            data_items: z.number(),
            page_current: z.number(),
            page_total: z.number(),
            have_next_page: z.boolean(),
            have_previous_page: z.boolean(),
          }),
        },
      },
      description: 'Lista de vendedores',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Parámetros inválidos (falta ref)',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(getListRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const query = c.req.valid('query');
  const page = parseInt(query.page ?? '1', 10);
  const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);
  const is_active = query.is_active !== undefined
    ? query.is_active === 'true'
    : undefined;

  try {
    const { data, total } = await getSellers(db, page, limit, query.search, is_active);
    return c.json(buildPaginatedResponse(data, total, page, limit), 200);
  } catch (err) {
    console.error('GET /sellers error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── GET /sellers/:id ─────────────────────────────────────────────────────────

const getByIdRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Sellers'],
  summary: 'Obtener vendedor por ID',
  request: {
    params: SellerIdParam,
    query: SellerByIdQuery,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.record(z.string(), z.unknown()),
          }),
        },
      },
      description: 'Vendedor encontrado',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Parámetros inválidos',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Vendedor no encontrado',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(getByIdRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const { id } = c.req.valid('param');

  try {
    const seller = await getSellerById(db, parseInt(id, 10));
    return c.json({ success: true, data: seller }, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ success: false, error: 'Not Found', message: err.message }, 404);
    }
    console.error('GET /sellers/:id error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── POST /sellers ────────────────────────────────────────────────────────────

const createSellerRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Sellers'],
  summary: 'Crear contacto vendedor',
  description: 'Crea un contacto (is_seller=true) y su registro en sellers en una transacción atómica.',
  request: {
    query: SellerByIdQuery,
    body: {
      content: { 'application/json': { schema: CreateSellerBody } },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.record(z.string(), z.unknown()),
          }),
        },
      },
      description: 'Vendedor creado exitosamente',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Datos inválidos',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(createSellerRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const body = c.req.valid('json');

  try {
    const seller = await createSeller(db, body);
    return c.json({ success: true, data: seller }, 201);
  } catch (err) {
    console.error('POST /sellers error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── PATCH /sellers/:id ───────────────────────────────────────────────────────

const updateSellerRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['Sellers'],
  summary: 'Actualizar contacto vendedor',
  description: 'Actualiza los campos del contacto y/o del vendedor. Solo se modifican los campos enviados.',
  request: {
    params: SellerIdParam,
    query: SellerByIdQuery,
    body: {
      content: { 'application/json': { schema: UpdateSellerBody } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.record(z.string(), z.unknown()),
          }),
        },
      },
      description: 'Vendedor actualizado exitosamente',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Datos inválidos',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Vendedor no encontrado',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(updateSellerRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const seller = await updateSeller(db, parseInt(id, 10), body);
    return c.json({ success: true, data: seller }, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ success: false, error: 'Not Found', message: err.message }, 404);
    }
    console.error('PATCH /sellers/:id error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── DELETE /sellers/:id ──────────────────────────────────────────────────────

const deleteSellerRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Sellers'],
  summary: 'Eliminar contacto vendedor (soft delete)',
  description: 'Marca como eliminados el vendedor y su contacto (deleted_at). No borra registros de la BD.',
  request: {
    params: SellerIdParam,
    query: SellerDeleteQuery,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: 'Vendedor eliminado exitosamente',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Parámetros inválidos',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Vendedor no encontrado',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(deleteSellerRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const { id } = c.req.valid('param');
  const query = c.req.valid('query');
  const deleted_by_user_id = query.deleted_by_user_id
    ? parseInt(query.deleted_by_user_id, 10)
    : undefined;

  try {
    await deleteSeller(db, parseInt(id, 10), deleted_by_user_id);
    return c.json({ success: true, message: `Seller ${id} deleted successfully` }, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ success: false, error: 'Not Found', message: err.message }, 404);
    }
    console.error('DELETE /sellers/:id error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export default router;
