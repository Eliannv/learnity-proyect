# Plantilla de módulo del backend

La mantiene `arquitecto` y se basa en los ADR-001, 003, 004 y 006, que están *Propuestos* hasta la Puerta 1. `be-b` adapta `backend/scripts/crear-modulos.mjs` para que genere esta estructura.

## 1. Estructura

```
backend/src/modules/<m>/
  index.ts            API pública: lo único que importan app.ts y otros módulos
  <m>.routes.ts       URL + verbo + middlewares (orden fijo, §3) + controlador
  <m>.controller.ts   HTTP: lee datos ya validados, llama al servicio, fija estado y encabezados
  <m>.service.ts      reglas de negocio, autorización por rol Y propiedad, transacciones
  <m>.repository.ts   todo el SQL del módulo, parametrizado
  <m>.esquemas.ts     esquemas zod de parámetros, consulta y cuerpo (y sus tipos inferidos)
  <m>.modelo.ts       tipos públicos del dominio (los que puede ver otro módulo)
  [puertos.ts]        solo si el módulo define un puerto (ADR-004)
  [<sub>/]            subdominio con la misma forma (p. ej. cursos/temario/)
backend/test/<m>/     pruebas del módulo (dueño: el del módulo; caracterización: qa-edge)
```

Los nombres van por dominio, nunca por persona (`*-integracion`, `*Integrante2`).

## 2. Qué va en cada capa

| Capa | Sí | No |
|---|---|---|
| `routes` | Ruta, verbo, `limitarPorIp`, `verificarOrigen`/`exigirCsrf`, `autenticar`, `autorizar`, `validarParametros`/`validarConsulta`/`validarCuerpo` y el controlador | Lógica, SQL, `try/catch` |
| `controller` | `datosValidados(res)`, `req.body`, `req.usuario`, `res.status(n).json(...)`, cookies y encabezados | `parse`/`safeParse`, reglas de negocio, SQL, acceso a otros módulos |
| `service` | Reglas de negocio, `AppError`, rol **y** propiedad (defensa en profundidad), `enTransaccion`, `registrarEvento`, llamadas a `../<otro>/index.js` y a puertos | `req`/`res`, SQL, `console.*`, lecturas de disco con filas bloqueadas |
| `repository` | SQL con `$1…`; los fragmentos dinámicos solo salen de un `Record` o una lista cerrada del código; mapear las filas a `modelo` | Reglas de negocio, `AppError` (salvo traducir un "no encontrado" si se documenta), datos del cliente concatenados |
| `esquemas` | `z.strictObject` cuando el contrato no admite claves extra; mensajes en español | Tipos de respuesta |
| `modelo` | Interfaces y tipos que exporta `index.ts` | Lógica |

**Transacciones.** Siempre con `enTransaccion` (`shared/database`). Lo que bloquea filas (`FOR UPDATE`) se hace dentro de la transacción y **nunca** junto con E/S lenta (disco, correo o red). Los efectos externos (borrar archivos, enviar correos) van **después** del `COMMIT`.

**Auditoría de base de datos.** Cuando `db` lo active, el servicio fija el actor con `set_config('learnity.id_persona', $1, true)` dentro de la transacción. Lo hace el ayudante de `shared/database`; ningún módulo escribe ese SQL por su cuenta.

**Errores.** Solo con `AppError` (`solicitudInvalida`, `noAutenticado`, `sinPermiso`, `noEncontrado`, `conflicto` y `demasiadasPeticiones`). El cuerpo siempre es `{ error: { codigo, mensaje, detalles } }`. Los códigos y mensajes que ya existen **son contrato** y no se cambian sin un ADR.

**Log.** Solo con `registrarEvento(evento, datos, nivel)`: con `idPeticion` automático (ADR-006) y sin contraseñas, tokens, cookies, cuerpos de petición ni `archivo.ruta`.

## 3. Orden de middlewares en `routes`

```
limitarPorIp → verificarOrigen/exigirCsrf (solo /auth) → autenticar → autorizar(...) →
validarParametros → validarConsulta → validarCuerpo → [middlewares propios, p. ej. multipart] → controlador
```

Así, el 429, el 403 de origen o CSRF, el 401 y el 403 de rol llegan antes que el 400, igual que hoy. Si una ruta no sigue este orden, se explica en un comentario (por ejemplo, la subida de PDF comprueba los permisos antes de leer el multipart).

## 4. Plantilla de `index.ts`

```ts
// modules/<m>/index.ts — API pública del módulo <m>.
// Otros módulos y app.ts SOLO importan desde aquí. Nada de repositorios, esquemas ni controladores.
export { <m>Routes } from './<m>.routes.js';
export type { Servicio<M> } from './<m>.service.js';     // interfaz que pueden usar otros módulos
export { <m>Api } from './<m>.service.js';                // objeto que implementa Servicio<M> (solo lo público)
export type { /* tipos públicos */ } from './<m>.modelo.js';
// Solo si el módulo define un puerto (ADR-004):
export { registrar<Puerto> } from './puertos.js';
export type { <Puerto> } from './puertos.js';
```

`app.ts` (de `be-a`) monta los routers desde `index.ts` y registra los puertos al crear la app, junto a `registrarVerificadorSesion`.

## 5. Lista de revisión de integración (`arquitecto`)

Se ejecuta sobre la rama del dueño antes de cada integración en `integration/sprint-2`. El reporte pega la salida real.

| # | Regla | Comando | Esperado |
|---|---|---|---|
| R1 | Ningún import interno entre módulos | `grep -rnE "from '\.\./[a-z-]+/[a-zA-Z.-]+\.js'" backend/src/modules \| grep -v "/index\.js'"` | Vacío (o solo deuda aún no migrada, con un dueño asignado) |
| R2 | `shared` no depende de módulos | `grep -rn "modules/" backend/src/shared` | Vacío |
| R3 | `app.ts` solo importa `index.ts` | `grep -nE "modules/[a-z-]+/[a-zA-Z.-]+\.js" backend/src/app.ts \| grep -v "/index\.js'"` | Vacío |
| R4 | SQL solo en repositorios | `grep -rnE "consultar[<(]\|\.query[<(]" backend/src --include=*.ts \| grep -v "\.repository\.ts:"` | Solo `shared/database/pool.ts` |
| R5 | Sin datos del cliente interpolados en SQL | `grep -rn '\${' backend/src/modules/*/*.repository.ts` y revisar cada línea | Cada `${…}` es una constante o un elemento de una lista cerrada |
| R6 | Controladores sin validación ni reglas | `grep -rnE "\.(safeParse\|parse)\(" backend/src/modules/*/*.controller.ts` | Vacío (después del ADR-006) |
| R7 | Sin `console.*` en la aplicación | `grep -rn "console\." backend/src --include=*.ts \| grep -v "database/seed.ts"` | Vacío (después del ADR-006) |
| R8 | Nunca se expone `ruta` | `grep -rn "ruta" backend/src/modules --include=*.ts` y revisar | Solo en el repositorio o el almacén de Contenido, nunca en un `modelo` ni en una respuesta |
| R9 | Contrato sin cambios | Regenerar `openapi.yaml` (procedimiento de `docs/api/COMPARACION_RUTAS.md`) y `git diff --exit-code docs/api/openapi.yaml`; `comparar-rutas.mjs` → 33/33, 0 y 0 | Sin diferencias, o un ADR aprobado que las justifique |
| R10 | Compila y pasa | `npm run build`, `npm run typecheck` y la suite (con turno del lead) | exit 0, sin cambiar expectativas (salvo las CONGELADO-INSEGURO que actualice un ADR aprobado, en el mismo commit) |
| R10b | `npm test` incluye todas las suites | `node -e "console.log(require('./backend/package.json').scripts['test:local'])"` | Usa el glob `test/**/*.test.ts` (cubre `test/caracterizacion/**` y `test/seguridad/**`), no una lista de archivos |
| R11 | Nombres por dominio | `git ls-files backend/src \| grep -iE "integrante\|integracion"` | Vacío al cerrar la Fase 2B |

## 6. Pruebas del módulo

- Las pruebas importan el `index.ts` del módulo (y `crearApp()` para HTTP), no sus archivos internos. Si una prueba necesita sustituir una dependencia, lo hace a través de la API pública o de un puerto.
- **`npm test` ejecuta todas las suites por glob** (H10 de `RIESGOS.md`). Hoy `test:local` enumera los archivos uno a uno, así que una suite nueva en `test/caracterizacion/**`, `test/seguridad/**` o `test/<m>/**` no se ejecutaría. En la Fase 2A, `arquitecto` cambia `test:local` en `backend/package.json` por el glob `test/**/*.test.ts` (conservando `--env-file=.env.test`, `--test-concurrency=1` y la exclusión de HIBP) y comprueba que el número de pruebas no baja.
- Toda suite que toque la base importa `backend/test/ayudas/guardia-bd.ts` (de `qa-edge`), que aborta si `DB_NAME` no termina en `_test`.
- La caracterización (`backend/test/caracterizacion/**`, de `qa-edge`) tiene que estar en verde **antes** de mover código, y se sigue ejecutando después sin cambios.
