import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { resolveDb, buildPaginatedResponse } from '../utils/request.utils';
import { NotFoundError } from '../utils/errors';
import {
  ContactsListQuery,
  ContactByIdQuery,
  ContactDeleteQuery,
  ContactIdParam,
  CreateContactBody,
  UpdateContactBody,
} from '../schemas/contacts.schemas';
import {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
} from '../services/contacts.service';

const router = new OpenAPIHono();

// ─── Schemas de respuesta locales ─────────────────────────────────────────────

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  message: z.string().optional(),
});

// ─── GET /contacts ────────────────────────────────────────────────────────────

const getListRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Contacts'],
  summary: 'Obtener lista de contactos',
  description: [
    'Retorna la lista paginada de contactos.',
    '',
    '**Filtro `type`:**',
    '- `seller` → vendedores (`is_seller = true`)',
    '- `customer` → clientes (`is_customer = true`)',
    '- `supplier` → proveedores (`is_supplier = true`)',
    '- `employee` → empleados (`is_employee = true`)',
    '- `prospect` → prospectos (`is_prospect = true`)',
    '',
    'El campo `seller_code` y `seller_is_active` solo aparecen cuando el contacto es vendedor.',
  ].join('\n'),
  request: { query: ContactsListQuery },
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
      description: 'Lista de contactos',
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
  const page  = parseInt(query.page  ?? '1',  10);
  const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);

  try {
    const { data, total } = await getContacts(db, page, limit, query.search, query.type);
    return c.json(buildPaginatedResponse(data, total, page, limit), 200);
  } catch (err) {
    console.error('GET /contacts error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── GET /contacts/:id ────────────────────────────────────────────────────────

const getByIdRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Contacts'],
  summary: 'Obtener contacto por ID',
  description: 'Retorna el contacto completo. Si es vendedor, incluye `seller_code` y `seller_is_active`.',
  request: {
    params: ContactIdParam,
    query: ContactByIdQuery,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), data: z.record(z.string(), z.unknown()) }),
        },
      },
      description: 'Contacto encontrado',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Parámetros inválidos',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Contacto no encontrado',
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
    const contact = await getContactById(db, parseInt(id, 10));
    return c.json({ success: true, data: contact }, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ success: false, error: 'Not Found', message: err.message }, 404);
    }
    console.error('GET /contacts/:id error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── POST /contacts ───────────────────────────────────────────────────────────

const createContactRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Contacts'],
  summary: 'Crear contacto',
  description: [
    'Crea un nuevo contacto. Puede ser cualquier tipo o combinación de tipos.',
    '',
    '**Si `is_seller = true`**: también crea el registro en la tabla `sellers` automáticamente.',
    'Puedes incluir `seller_code` y `seller_is_active` en el mismo body.',
    '',
    '**Ejemplos:**',
    '- Cliente: `{ "contact_name": "...", "is_customer": true }`',
    '- Proveedor: `{ "contact_name": "...", "is_supplier": true }`',
    '- Empleado-Vendedor: `{ "contact_name": "...", "is_employee": true, "is_seller": true, "seller_code": "V001" }`',
  ].join('\n'),
  request: {
    query: ContactByIdQuery,
    body: {
      content: { 'application/json': { schema: CreateContactBody } },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), data: z.record(z.string(), z.unknown()) }),
        },
      },
      description: 'Contacto creado exitosamente',
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
router.openapi(createContactRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const body = c.req.valid('json');

  try {
    const contact = await createContact(db, body);
    return c.json({ success: true, data: contact }, 201);
  } catch (err) {
    console.error('POST /contacts error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── PATCH /contacts/:id ──────────────────────────────────────────────────────

const updateContactRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['Contacts'],
  summary: 'Actualizar contacto',
  description: [
    'Actualiza los campos enviados del contacto.',
    '',
    '**Comportamiento especial:**',
    '- Si se envía `is_seller: true` y el contacto aún no tiene registro en `sellers`, lo crea automáticamente.',
    '- Si ya existe el registro en `sellers`, `seller_code` y `seller_is_active` lo actualizan.',
  ].join('\n'),
  request: {
    params: ContactIdParam,
    query: ContactByIdQuery,
    body: {
      content: { 'application/json': { schema: UpdateContactBody } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), data: z.record(z.string(), z.unknown()) }),
        },
      },
      description: 'Contacto actualizado',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Datos inválidos',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Contacto no encontrado',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(updateContactRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const contact = await updateContact(db, parseInt(id, 10), body);
    return c.json({ success: true, data: contact }, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ success: false, error: 'Not Found', message: err.message }, 404);
    }
    console.error('PATCH /contacts/:id error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ─── DELETE /contacts/:id ─────────────────────────────────────────────────────

const deleteContactRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Contacts'],
  summary: 'Eliminar contacto (soft delete)',
  description: 'Marca como eliminado el contacto y su registro en `sellers` si existe.',
  request: {
    params: ContactIdParam,
    query: ContactDeleteQuery,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
      description: 'Contacto eliminado',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Parámetros inválidos',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Contacto no encontrado',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno',
    },
  },
});

// @ts-ignore -- Zod v4 + @hono/zod-openapi response type inference issue
router.openapi(deleteContactRoute, async (c) => {
  const resolved = resolveDb(c);
  if (resolved.kind === 'error') return c.json(resolved.body, resolved.status);
  const { db } = resolved;

  const { id } = c.req.valid('param');
  const query = c.req.valid('query');
  const deleted_by_user_id = query.deleted_by_user_id
    ? parseInt(query.deleted_by_user_id, 10)
    : undefined;

  try {
    await deleteContact(db, parseInt(id, 10), deleted_by_user_id);
    return c.json({ success: true, message: `Contact ${id} deleted successfully` }, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ success: false, error: 'Not Found', message: err.message }, 404);
    }
    console.error('DELETE /contacts/:id error:', err);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export default router;
