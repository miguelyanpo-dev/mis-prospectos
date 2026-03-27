import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from './middlewares/logger';
import { config } from './config/config';
import contactsRouter from './routes/contacts.routes';

const app = new Hono();
const apiV1 = new OpenAPIHono();

// CORS middleware
app.use('*', cors({
  origin: config.cors.origins,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 600,
  credentials: true,
}));

// Logger middleware
app.use('*', logger());

// Mount routes
apiV1.route('/contacts', contactsRouter);

// OpenAPI documentation
apiV1.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'HBSP — Gestión de Contactos API',
    version: '1.0.0',
    description: [
      'API REST multi-tenant para gestionar contactos: **clientes**, **proveedores**, **empleados** y **vendedores**.',
      '',
      '## Autenticación / Multi-tenant',
      'Todos los endpoints requieren el parámetro `?ref=<supabase_project_ref>` para resolver la base de datos del tenant.',
      '',
      '## Tipos de contacto',
      'Un contacto puede ser uno o varios tipos simultáneamente mediante flags booleanos:',
      '- `is_customer` → Cliente',
      '- `is_supplier` → Proveedor',
      '- `is_employee` → Empleado',
      '- `is_seller` → Vendedor *(genera registro en tabla `sellers`)*',
      '- `is_prospect` → Prospecto',
      '',
      '## Paginación',
      'Los endpoints de lista retornan: `data`, `data_items`, `page_current`, `page_total`, `have_next_page`, `have_previous_page`.',
      '',
      '## Soft Delete',
      'Los registros nunca se borran físicamente. Se llenan los campos `deleted_at` y `deleted_by_user_id`.',
    ].join('\n'),
  },
  tags: [
    {
      name: 'Contacts',
      description: 'CRUD de contactos. Gestiona clientes, proveedores, empleados y vendedores desde un único endpoint.',
    },
  ],
  servers: [
    {
      url: `http://localhost:${config.port}/api/v1`,
      description: 'Servidor de desarrollo local',
    },
    {
      url: `${config.productionUrl}/api/v1`,
      description: 'Servidor de producción',
    },
  ],
});

apiV1.get('/doc', swaggerUI({
  url: '/api/v1/openapi.json',
  title: 'HBSP Gestión de Contactos',
}));

app.route('/api/v1', apiV1);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    path: c.req.path,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
  }, 500);
});

export default app;
