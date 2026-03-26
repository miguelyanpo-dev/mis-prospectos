# HBSP Mis Prospectos API

API REST para el módulo de **Mis Prospectos**, construida con [Hono](https://hono.dev/) + TypeScript, desplegada en Vercel.

## Stack

- **Runtime**: Node.js / Vercel Edge
- **Framework**: Hono
- **Lenguaje**: TypeScript
- **Base de datos**: PostgreSQL
- **Documentación**: OpenAPI 3.0 + Swagger UI

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Correr en modo desarrollo
npm run dev
```

El servidor corre en `http://localhost:3000`  
Swagger UI disponible en `http://localhost:3000/api/v1/doc`

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor en modo desarrollo con hot reload |
| `npm run build` | Compila TypeScript |
| `npm start` | Corre la versión compilada |
| `npm run type-check` | Verifica tipos sin compilar |

## Estructura

```
src/
├── config/         # Configuración y conexión a BD
├── controllers/    # Handlers de cada endpoint
├── middlewares/    # Logger, auth, etc.
├── routes/         # Definición de rutas OpenAPI
├── schemas/        # Esquemas Zod
├── services/       # Lógica de negocio y queries
├── utils/          # Utilidades compartidas
├── app.ts          # Setup de Hono
└── index.ts        # Entry point
```
