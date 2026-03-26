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
    title: 'HBSP Gestión de Contactos API',
    version: '1.0.0',
    description: 'API REST para gestionar contactos: clientes, proveedores, empleados y vendedores.',
  },
  servers: [
    {
      url: `${config.productionUrl}/api/v1`,
      description: 'Production server',
    },
    {
      url: `http://localhost:${config.port}/api/v1`,
      description: 'Development server',
    },
  ],
});

apiV1.get('/doc', swaggerUI({ url: '/api/v1/openapi.json' }));

app.route('/api/v1', apiV1);

// 404 handler
app.notFound((c) => {
  return c.json({ 
    success: false,
    error: 'Not Found', 
    path: c.req.path 
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ 
    success: false,
    error: 'Internal Server Error', 
    message: err.message 
  }, 500);
});

export default app;
