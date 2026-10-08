# Control Diario

Sistema multiempresa de registro y análisis de ventas. Aplicación inicial Next.js.

## Alcance acordado
- Empresas → gerencias → equipos → vendedores independientes.
- Roles: administrador, gerente, supervisor, vendedor, analista.
- Carga por cantidad diaria y ventas individuales sin estados ni metas.
- Consolidación sin duplicar ventas: las ventas individuales explícitamente incluidas en el total diario no se suman de nuevo.
- Auditoría, rankings, reportes e importación histórica de Excel.

## Inicio local
1. `npm install`
2. Crear `.env.local` a partir de `.env.example` (nunca subir credenciales).
3. `npm run dev`

## Base de datos
El diseño inicial está en `db/schema.sql`. **No ejecutar automáticamente contra una base existente**: verificar respaldos, privilegios y compatibilidad antes de aplicar. No se han aplicado migraciones.

## Pendiente antes de producción
Autenticación segura y autorización en servidor, controles por empresa, migraciones versionadas, conciliación de registros, importador con vista previa y pruebas, dashboards conectados, conexión y despliegue Vercel. La página actual es un punto de partida, no un sistema operativo.
