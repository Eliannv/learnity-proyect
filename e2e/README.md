# E2E de Learnity (Playwright + Chromium)

Pruebas de navegador contra **`learnity_test`**. Nunca contra `Learnity` (guarda en `global-setup.ts`, ADR-009).
Requieren turno del lead: comparten la base con las suites de `backend/`.

## Arranque

```
cd e2e
npm install                      # una vez (hay package-lock.json; npm ci también sirve)
npx playwright install chromium  # una vez
npm test                         # levanta API y frontend solos, corre las 8 specs y limpia
```

`playwright.config.ts` arranca dos servidores propios (no reutiliza los de desarrollo):

| Servidor | Comando | Puerto |
|---|---|---|
| API | `npx tsx src/server.ts` en `backend/`, con `backend/.env.test` y estas variables pisadas: `PORT=3100`, `CORS_ORIGIN`/`FRONTEND_URL=http://localhost:4300`, `CORREO_TRANSPORTE=buzon`, `BUZON_DIR` y `PDF_DIR` en `e2e/.tmp/`, `HIBP_ACTIVO=false`, `COOKIE_SECURE=false` | 3100 |
| Frontend | `ng serve --port 4300 --proxy-config ../e2e/proxy.e2e.conf.json` en `frontend/` (`/api` → 3100) | 4300 |

El primer arranque de `ng serve` tarda (hasta ~4 min de margen). Los límites por IP del backend (20 inicios de sesión, 10 registros y 5 recuperaciones cada 15 min) son de memoria: se reinician en cada ejecución, que usa unos 13 inicios de sesión.

## Datos y limpieza

- `soporte/bd.ts` reutiliza los fixtures de `backend/test/ayudas/` (SQL directo, `SET ROLE learnity_pruebas` si existe) para crear cuentas por rol y categorías.
- Todo lo creado lleva una **marca** de ejecución (`E2E_MARCA`): `persona.nombres`, prefijo de correos `@qa-edge.test`, títulos de curso y categorías. `global-teardown.ts` llama a `limpiarMarca` e imprime `RESIDUOS_TRAS_LIMPIEZA {...}` (todo en 0 si limpió bien).
- Correos de recuperación: transporte `buzon` en `e2e/.tmp/buzon` (se lee el enlace del JSON).

## Specs

| Spec | Caso del PLAN_PRUEBAS |
|---|---|
| `01-sesion` | E2E-01: cookies (`learnity_rt` HttpOnly, `XSRF-TOKEN`), sin token en `localStorage`/`sessionStorage`, refresh al recargar, logout |
| `02-guards-roles` | E2E-02: visitante, estudiante, docente y admin; Mi aprendizaje y seguimiento docente accesibles por rol; rutas de evaluaciones y usuarios aún no disponibles |
| `03-catalogo-recuperacion` | catálogo vacío/404 y recuperación de contraseña de punta a punta |
| `04-solicitud-docente` | E2E-03: XSS como texto en perfil y bandeja admin; aprobación y rol nuevo |
| `05-ciclo-curso-pdf` | E2E-04 y E2E-07: borrador → PDF → revisión → publicación → catálogo → inscripción del estudiante → PDF y progreso persistente → seguimiento docente; bloqueo en EN_REVISION y PUBLICADO |
| `06-accesibilidad` | E2E-05: axe WCAG A/AA en públicas y paneles, foco visible, campos con etiqueta |
| `07-responsive-390` | E2E-06: sin scroll horizontal a 390 px |
