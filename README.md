# App Web S360 - Muestras de Aceite (Next.js)

Migracion completa a Next.js (App Router) con consumo directo de la API S360.

## Requisitos

- Node.js 20+

## Instalacion

```bash
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```env
S360_BASE_URL=https://api.s360web.com
S360_API_PASSWORD=
S360_SUBSCRIPTION_KEY=
```

Notas:

- El usuario S360 queda fijo en `amiotti@secco.com.ar`.
- `S360_SUBSCRIPTION_KEY` es opcional segun entorno.

## Ejecutar en local

```bash
npm run dev
```

Abre:

- `http://localhost:3000`

## Build de produccion

```bash
npm run build
npm run start
```

## Rutas principales

- `/` Landing
- `/dashboard` Plataforma principal
- `/dasboard` Alias que redirige a `/dashboard`

## APIs internas (Next Route Handlers)

- `GET /api/equipment`
- `POST /api/samples/search`
- `GET /api/samples/[sampleNumber]`
- `GET /api/samples/[sampleNumber]/pdf`