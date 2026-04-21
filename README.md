# App Web S360 - Muestras de Aceite

Aplicacion web con:

- Registro y login de usuarios de la app.
- Conexion a API S360 (por defecto produccion: `https://api.s360web.com`).
- Carga de equipos disponibles del usuario S360.
- Busqueda de muestras filtrando por equipo.
- Resumen operativo (totales, estados, leidos/no leidos).
- Detalle tecnico de muestra y resultados de analisis.

## 1) Requisitos

- Node.js 20+

## 2) Instalacion

```bash
npm install
```

## 3) Configuracion

Copiar `.env.example` a `.env` y completar los valores necesarios.

```env
PORT=3000
APP_SESSION_SECRET=una-clave-larga
SQLITE_PATH=./data/app.db

S360_BASE_URL=https://api.s360web.com
S360_API_USERNAME=
S360_API_PASSWORD=
S360_SUBSCRIPTION_KEY=
S360_ALLOW_INSECURE_TLS=false
```

Notas:

- Si no completas usuario/clave en `.env`, podes ingresarlos en la pantalla de conexion.
- `S360_SUBSCRIPTION_KEY` es opcional y depende de la politica del entorno.

## 4) Ejecutar

```bash
npm start
```

Abrir en navegador:

- `http://localhost:3000`

## 5) Flujo recomendado

1. Crear cuenta desde `/register`.
2. Iniciar sesion.
3. Conectar a S360 y cargar equipos.
4. Seleccionar equipo y ejecutar busqueda.
5. Abrir detalle de muestra para ver analisis.

## 6) Endpoints S360 usados

- `POST /api/login`
- `POST /api/v1/equipamento/list`
- `POST /api/v1/sampleResult/search`
- `GET /api/v1/sampleResult/view/{sampleNumber}`

## 7) Script opcional para alta por consola

```bash
npm run create-user -- --email usuario@empresa.com --password ClaveSegura123
```
