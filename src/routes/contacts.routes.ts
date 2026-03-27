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
  ContactSchema,
} from '../schemas/contacts.schemas';
import {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
} from '../services/contacts.service';

const router = new OpenAPIHono();

// ─── Schemas de respuesta reutilizables ───────────────────────────────────────

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  message: z.string().optional(),
});

const SingleContactResponse = z.object({
  success: z.boolean(),
  data: ContactSchema,
});

const PaginatedContactResponse = z.object({
  success: z.boolean(),
  data: z.array(ContactSchema),
  data_items: z.number().describe('Total de registros encontrados'),
  page_current: z.number().describe('Página actual'),
  page_total: z.number().describe('Total de páginas'),
  have_next_page: z.boolean(),
  have_previous_page: z.boolean(),
});

const DeleteSuccessResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ─── Ejemplos reutilizables ───────────────────────────────────────────────────

const EXAMPLE_CUSTOMER = {
  contact_name: 'Empresa ABC S.A.S.',
  identification: '900123456-1',
  company_name: 'ABC S.A.S.',
  phone_mobile: '+57 310 000 0001',
  email: 'contacto@abc.com',
  is_customer: true,
  address_billing_city: 'Bogotá',
  created_by_user_id: 1,
};

const EXAMPLE_SELLER = {
  contact_name: 'Carlos López',
  identification: '1020304050',
  phone_mobile: '+57 300 000 0001',
  email: 'carlos.lopez@empresa.com',
  is_employee: true,
  is_seller: true,
  seller_code: 'V001',
  seller_is_active: true,
  created_by_user_id: 1,
};

const EXAMPLE_SUPPLIER = {
  contact_name: 'Proveedor XYZ Ltda.',
  identification: '800987654-2',
  company_name: 'XYZ Ltda.',
  phone_mobile: '+57 320 000 0001',
  email: 'ventas@xyz.com',
  is_supplier: true,
  created_by_user_id: 1,
};

// ─── GET /contacts ────────────────────────────────────────────────────────────

const getListRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Contacts'],
  summary: 'Listar contactos',
  description: [
    'Retorna la lista paginada de contactos con soporte de búsqueda y filtro por tipo.',
    '',
    '### Filtro `type`',
    '| Valor | Descripción |',
    '|---|---|',
    '| `seller` | Vendedores (`is_seller = true`) — incluye `seller_code` y `seller_is_active` |',
    '| `customer` | Clientes (`is_customer = true`) |',
    '| `supplier` | Proveedores (`is_supplier = true`) |',
    '| `employee` | Empleados (`is_employee = true`) |',
    '| `prospect` | Prospectos (`is_prospect = true`) |',
    '',
    '> Sin `type` retorna todos los contactos activos.',
  ].join('\n'),
  request: { query: ContactsListQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: PaginatedContactResponse } },
      description: 'Lista de contactos paginada',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Falta el parámetro `ref`',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Error interno del servidor',
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
  description: 'Retorna el contacto completo. Si es vendedor, incluye `seller_id`, `seller_code` y `seller_is_active`.',
  request: {
    params: ContactIdParam,
    query: ContactByIdQuery,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SingleContactResponse } },
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
    'Crea un nuevo contacto. Un contacto puede tener uno o varios tipos simultáneamente.',
    '',
    '### Comportamiento automático',
    '- Si `is_seller = true` → crea el registro en la tabla `sellers` en la misma transacción.',
    '- Los campos `seller_code` y `seller_is_active` solo aplican cuando `is_seller = true`.',
    '',
    '### Tipos de contacto',
    '| Flag | Descripción |',
    '|---|---|',
    '| `is_customer` | Cliente |',
    '| `is_supplier` | Proveedor |',
    '| `is_employee` | Empleado |',
    '| `is_seller` | Vendedor (genera registro en tabla `sellers`) |',
    '| `is_prospect` | Prospecto |',
  ].join('\n'),
  request: {
    query: ContactByIdQuery,
    body: {
      content: {
        'application/json': {
          schema: CreateContactBody,
          example: EXAMPLE_CUSTOMER,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: SingleContactResponse } },
      description: 'Contacto creado exitosamente',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Datos inválidos o falta `ref`',
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

// ─── POST /contacts/seller — ejemplo específico de vendedor ──────────────────
// (ruta de conveniencia documentada como ejemplo adicional en el POST)

// ─── PATCH /contacts/:id ──────────────────────────────────────────────────────

const updateContactRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['Contacts'],
  summary: 'Actualizar contacto',
  description: [
    'Actualiza únicamente los campos enviados en el body.',
    '',
    '### Comportamiento especial',
    '- **`is_seller: true`** en un contacto que no era vendedor → crea automáticamente el registro en `sellers`.',
    '- **`seller_code` / `seller_is_active`** → actualiza la tabla `sellers` si ya existe el registro.',
  ].join('\n'),
  request: {
    params: ContactIdParam,
    query: ContactByIdQuery,
    body: {
      content: {
        'application/json': {
          schema: UpdateContactBody,
          example: {
            phone_mobile: '+57 310 999 8888',
            email: 'nuevo@email.com',
            is_customer: true,
            updated_by_user_id: 1,
          },
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SingleContactResponse } },
      description: 'Contacto actualizado exitosamente',
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
  summary: 'Eliminar contacto',
  description: [
    'Soft delete: llena `deleted_at` en el contacto.',
    'Si el contacto tenía registro en `sellers`, también lo marca como eliminado.',
  ].join('\n'),
  request: {
    params: ContactIdParam,
    query: ContactDeleteQuery,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteSuccessResponse } },
      description: 'Contacto eliminado exitosamente',
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

export { EXAMPLE_CUSTOMER, EXAMPLE_SELLER, EXAMPLE_SUPPLIER };
export default router;
