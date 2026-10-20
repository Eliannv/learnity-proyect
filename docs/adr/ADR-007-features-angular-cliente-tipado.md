# ADR-007: Estructura de *features* en Angular y cliente HTTP tipado

- **Estado:** Aceptado (19-10-2026, Puerta 1, decisión P1-1)
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:** No. Las URLs de la SPA y las llamadas HTTP siguen siendo las mismas.
- **Depende de:**
  - ADR-008, para generar los tipos o escribirlos a mano;
  - **D3** (paneles huérfanos) y **D4** (flag para las pantallas del Sprint 3/4), que siguen **pendientes** y se preguntan en la Puerta 1. Este ADR no las da por decididas.

## Contexto

Frontend Angular 21 con componentes *standalone*, Vitest y 20/20 pruebas en verde.
- **Lo que ya está bien:**
  - carga diferida en las 23 rutas;
  - guards `invitadoGuard`, `autenticadoGuard`, `rolGuard`, `perfilEstudianteGuard` y `conSesionMatch`;
  - sin `localStorage` ni `innerHTML`;
  - interceptor de sesión (`core/auth/auth.interceptor.ts`).
- **Lo que falla:**
  - **Las rutas están todas juntas (F5):** `app.routes.ts` tiene 267 líneas, sin rutas por *feature*.
  - **Los servicios HTTP están repartidos y sin contrato común (F3):**
    - `core/auth/auth.service.ts` y `perfil.service.ts`;
    - `core/cursos/gestion-cursos.api.ts` (170 líneas) con sus tipos escritos a mano en `gestion-cursos.model.ts`;
    - `core/solicitudes/solicitudes-docente.service.ts`;
    - `pages/publico/cursos-publicos.service.ts`, que es un servicio dentro de `pages/`.

    Cada uno redefine los tipos de la API. Nada los liga a `openapi.yaml`: un cambio en el backend solo se descubre en tiempo de ejecución.
  - **Hay componentes grandes con plantilla en línea (F4):** `admin/solicitudes/solicitudes.ts` (465 líneas) y `editor-curso.ts` (316). Mezclan la llamada HTTP con la presentación.
  - **Las dependencias van al revés:** `shared/cursos/peticion.ts:4` importa `../../pages/auth/mensaje-error` (es decir, `shared` depende de `pages`). Además, `shared/ui/tarjeta-curso` y `portada-curso` usan tipos de `data/datos-demo.ts` (F1).
  - **Quedan datos de ejemplo en recorridos reales (F1):** 16 archivos importan `datos-demo` o `demo-sesiones`, entre ellos `publico/inicio`, `header-sitio`, `admin/categorias` y `admin/usuarios`.

La propiedad ya está repartida por *feature* (ESTADO.md):
- `fe-a`: `features/{identidad,catalogo,admin-categorias,usuarios}`, `core/{auth,http,solicitudes}` y `layouts`;
- `fe-b`: `features/{docente-cursos,contenido,revision}`, `core/{api,cursos,estado}` y `shared/{ui,cursos}`.

## Decisión propuesta

1. **Una carpeta por *feature*, con carga diferida:**

```
src/app/features/<f>/
  <f>.routes.ts      rutas hijas (loadComponent), guards y títulos
  paginas/           contenedores: inyectan <f>.api.ts, tienen el estado y orquestan
  componentes/       presentación: input()/output(), sin HttpClient ni servicios de datos
  <f>.api.ts         llamadas HTTP de la feature, tipadas con core/api
```

   `app.routes.ts` (de `fe-a`) queda como índice: `{ path: 'docente/cursos', loadChildren: () => import('./features/docente-cursos/docente-cursos.routes') }`. **Las URLs, guards y títulos son los de hoy.** Las rutas congeladas (Sprint 3/4) y lo que decidan D3 y D4 se resuelven en la Puerta 1, no aquí.

   Mapa propuesto, sin cambiar URLs:

| Feature | Dueño | Páginas actuales que absorbe |
|---|---|---|
| `identidad` | fe-a | `pages/auth/*`, `cuenta/ajustes-perfil`, `estudiante/perfil` |
| `catalogo` | fe-a | `publico/{inicio,catalogo,detalle-curso}` y `cursos-publicos.service.ts` |
| `admin-categorias` | fe-a | `admin/categorias` |
| `usuarios` | fe-a | `admin/solicitudes` y la tarjeta de solicitud del perfil (`admin/usuarios` sigue congelada) |
| `docente-cursos` | fe-b | `docente/mis-cursos`, `docente/editor-curso` y `shared/cursos/{listado-cursos,temario-curso}` |
| `contenido` | fe-b | `shared/cursos/pdf-leccion` |
| `revision` | fe-b | `admin/{revision-cursos,revision-curso}` |

2. **Cliente tipado en `core/api/` (de `fe-b`):**
   - `core/api/contrato.ts`: los tipos de las peticiones y respuestas. **Si se aprueba el ADR-008**, se generan desde `docs/api/openapi.yaml` en `core/api/generado/esquema.d.ts` y `contrato.ts` solo reexporta alias legibles (`export type CursoDetalle = components['schemas']['CursoDetalle']`). **Si no**, se escriben a mano en `contrato.ts`, con un comentario que enlaza cada tipo con su esquema del contrato.
   - Cada `<f>.api.ts` usa `HttpClient` con esos tipos, sin redefinirlos. Los modelos de `core/cursos/gestion-cursos.model.ts` y los de `cursos-publicos.service.ts` se sustituyen por los de `core/api`.
3. **`core/http/` (de `fe-a`):** mapeo de errores. `{ error: { codigo, mensaje, detalles } }` se convierte en un `ErrorApi` tipado, con `detalles` por campo. Sustituye a `pages/auth/mensaje-error` y corrige la dependencia de `shared/cursos/peticion.ts` hacia `pages/`. El interceptor de sesión se queda en `core/auth`.
4. **Estado de petición:** `shared/cursos/peticion.ts` pasa a `core/estado/peticion.ts` (`fe-b`). Un componente común de `shared/ui` muestra los estados de carga, vacío y error.
5. **Tipos de UI** (`Tono`, `ICONO_CATEGORIA` y otros de `datos-demo.ts:7,45`): se mueven a `shared/ui/tipos-ui.ts`. Ningún recorrido real importa `datos-demo.ts`. Si hace falta algún mock, va detrás de un flag apagado por defecto y se quita antes de cerrar la *feature* (`REGLAS_EQUIPO.md`, *Frontend*).
6. **Lo que se mantiene sin cambios:** guards, interceptor, `environment.*` y estilos globales.

## Opciones consideradas

### Opción A: mantener `pages/` y `core/` como están

| Dimensión | Valoración |
|---|---|
| Complejidad | Nula |
| Riesgo de regresión | Nulo |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Total |

**A favor:** no hay que hacer nada. **En contra:** las rutas siguen concentradas en un solo archivo, los tipos siguen duplicados y sin enlace con el contrato, y `fe-a` y `fe-b` editan los mismos archivos.

### Opción B: *features* con rutas propias y cliente tipado en `core/api` (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media (mover archivos y reescribir los imports) |
| Riesgo de regresión | Bajo-medio. Lo cubren `ng build`, las 20 pruebas y la caracterización e2e si se aprueba el ADR-009 |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta: es la estructura que recomienda Angular |

**A favor:** cada pareja trabaja en sus carpetas; el compilador detecta cuando el backend y el frontend se desalinean (si los tipos salen del contrato); queda clara la separación entre contenedor y presentación. **En contra:** muchos archivos movidos en un solo lote, lo que hace más difícil leer `git blame`.

### Opción C: B más librerías por dominio (Nx o *workspaces*)

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta |
| Riesgo de regresión | Medio |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Baja |

**A favor:** límites impuestos por la herramienta. **En contra:** dependencias y configuración nuevas, desproporcionadas para el tamaño actual.

### Opción D: estado global (NgRx o Signals Store) en cada *feature*

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta |
| Riesgo de regresión | Medio |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Baja |

**A favor:** patrones uniformes para el estado. **En contra:** las pantallas actuales tienen estado local y sencillo; `Peticion` con *signals* ya resuelve el caso. Añadiría una dependencia y sería sobreingeniería.

## Análisis de compromisos

B ordena el código y separa el trabajo de las dos parejas sin dependencias nuevas, salvo la opcional del ADR-008. La mejora más importante para la calidad es ligar los tipos al contrato. Por eso los hallazgos C-08 a C-11 de `COMPARACION_RUTAS.md` (esquemas duplicados y sin `required`) conviene cerrarlos en `openapi*.ts` **antes** de generar tipos: si no, los tipos generados saldrán laxos (campos opcionales que en realidad siempre llegan).

## Consecuencias

- **Más fácil:**
  - trabajar en paralelo (`fe-a` y `fe-b`);
  - probar los componentes de presentación sin `HttpClient`;
  - detectar en compilación cuándo la API y el frontend se desalinean;
  - borrar una *feature* entera.
- **Más difícil:**
  - el lote de movimientos inicial;
  - mantener `core/api` al día con el contrato. Con el ADR-008 basta con un comando; sin él, se hace a mano.
- **A revisar:**
  - D3 (borrar o restaurar `docente/panel` y `admin/panel`, F2);
  - D4 (flag de las pantallas del Sprint 3/4): definen qué rutas quedan en `app.routes.ts`.

## Acciones

1. [ ] Decisiones D3 y D4 en la Puerta 1 (el usuario).
2. [ ] `core/api/contrato.ts`, generado o escrito a mano según el ADR-008 (`fe-b`, Fase 2A).
3. [ ] `core/http/` con el mapeo de errores y `core/estado/peticion.ts`; quitar la dependencia `shared → pages` (`fe-a` y `fe-b`, Fase 2A).
4. [ ] `shared/ui/tipos-ui.ts`, para sacar los tipos de `datos-demo` (`fe-b`, Fase 2A).
5. [ ] Migrar cada *feature* a `features/<f>/` con su `<f>.routes.ts` (`fe-a` y `fe-b`, Fase 2B), y `app.routes.ts` como índice (`fe-a`).
6. [ ] Revisar en cada integración que ningún componente de `componentes/` inyecte `HttpClient` ni un `*.api.ts` (`arquitecto`).

## Cómo se verifica

```bash
cd frontend
npx ng build && npx ng test --watch=false            # verde, sin cambiar expectativas
grep -rln "datos-demo" src/app | grep -v "data/datos-demo.ts"   # solo rutas congeladas o detrás del flag de D4
grep -rln "HttpClient" src/app | grep -v "core/\|\.api\.ts\|app.config.ts"   # vacío
grep -rln "HttpClient\|\.api'" src/app/features/*/componentes 2>/dev/null     # vacío
grep -rn "pages/" src/app/shared src/app/core                                  # vacío
```

Además, las URLs de la SPA son las mismas (la comparación de `app.routes.ts` antes y después da el mismo conjunto de `path`).
