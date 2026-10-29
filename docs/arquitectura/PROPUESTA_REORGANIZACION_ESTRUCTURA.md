# Fase 1: diagnóstico y propuesta de reorganización

**Rama analizada:** `sprint4/elian` en `43b0f54`.

**Estado (29-10-2026): aprobada completa (F1–F19, B1–B2 y `youtube-sdk.ts`) y ejecutada en la rama `sprint4/elian-estructura`.** Respuestas aplicadas: módulos `revision` y `resenas` sin renombrar (con un comentario en sus `index.ts`), nombres en español, `openapi.yaml` regenerado (solo cambia la cabecera), título "Lección · Learnity" sin cambios y clases de las APIs sin renombrar. Cada lote se hizo en dos commits (solo movimientos con similitud del 100 %, luego imports) para conservar el historial:

| Lote | Commits | Validación |
|---|---|---|
| 1. `shared/ui` y `shared/estilos` | `9a5e0a1` | build y vitest 135/135 |
| 2. Layouts | `bb66a8c` | build y vitest 135/135 |
| 3. Administración | `75e5795` · `42a449c` | build, vitest 135/135 y E2E 26/26 |
| 4. Docente | `4e2c6e0` · `14ee318` | build y vitest 135/135 |
| 5. Aprendizaje, `seguimiento-curso`, rutas propias y `youtube-sdk` | `7c86e9c` · `d908f14` | build, vitest 135/135 y E2E 26/26 |
| 6. Backend (`shared/openapi`, `shared/database`) | `29254a8` · `8292678` | `tsc`, node:test 319/319 y `api:verificar` |

Los lotes 1 y 2 se hicieron en un solo commit cada uno; Git detectó todos sus archivos como renombrados.

El resto de este documento es la propuesta original, sin cambios.

**Resumen:** la arquitectura se cumple en lo esencial. En el backend no hay ninguna violación de acoplamiento. Los problemas son de organización en el frontend: restos de `pages/`, prefijos repetidos y `shared/ui` plano.

**Antes de aprobar, tres aclaraciones sobre el prompt:**
- **Nombres en español:** los módulos reales se llaman en español (`identidad`, `usuarios`, `catalogo`, `cursos`, `contenido`, `revision`, `aprendizaje`, `evaluaciones`, `categorias`, `resenas`, `analiticas`). Se propone no traducirlos.
- **Nombres corregidos:** el script se llama `api:tipos` y la tabla `auditoria_cambio`.
- **Layouts:** no existe un layout de estudiante; el estudiante usa el layout del sitio.

## 1. Hallazgos

### Frontend: incumple lo que ya decidió el ADR-007

- **`pages/` es un resto de la migración:** el ADR-007 eligió "una carpeta por feature" y mandaba migrar `pages/` (punto 5). Quedan cuatro vistas fuera de `features/`:
  - `pages/estudiante/inicio-estudiante`, `mi-aprendizaje` y `leccion`, que son de la feature `aprendizaje`.
  - `pages/docente/estudiantes`, que usa `docente-cursos/seguimiento-docente.api.ts`.
- **`leccion` tiene un nombre engañoso:** es la vista de seguimiento del curso inscrito, con temario, progreso, vídeo, PDF, evaluación y reseñas.
- **Prefijos de rol repetidos:** `admin-categorias`, `admin-resenas`, `admin-usuarios`, `docente-cursos`, `docente-resenas` y `docente-analiticas`.
- **Features de administración sin prefijo:**
  - `revision` (la cola de revisión de cursos) es solo de administración.
  - `usuarios` mezcla la página de solicitudes del administrador con el perfil del estudiante. Ese perfil ya se carga desde `identidad.routes.ts` mediante `../usuarios/...`.
- **`admin-resenas/paginas/reportes`:** desde que se añadió "Todas las reseñas", esa página ya no es solo de reportes.
- **Layouts duplicados:** hay dos carpetas, `layouts/` (panel, sitio y menú) y `shared/layout/` (header, footer, menú de cuenta, barra inferior y vista previa). Las piezas de `shared/layout` solo las usan los layouts.
- **`shared/ui` es plano:** 30 archivos en un solo nivel.
- **`shared/cursos/` solo contiene `cursos.scss`:** es un parcial de estilos que importan 10 hojas con `@use`.

### Frontend: correcto y sin cambios

- `core/` y `catalogo/`. `catalogo/resenas.api.ts` y `componentes/resenas-curso` son las reseñas públicas, que también se reutilizan en el aula.
- `contenido/` y `errores/`.
- La comprobación del ADR-007 (`HttpClient` solo en `core/` o en un `*.api.ts`) sale vacía: no hay incumplimientos.

### Backend: correcto

- Ningún import entre módulos se salta el `index.ts`, y `shared/` no importa nada de `modules/`.
- El grafo de dependencias no tiene ciclos: `contenido→cursos`, `cursos→aprendizaje`, `evaluaciones→aprendizaje`, `revision→cursos` y `usuarios→identidad`.

### Backend: variaciones de nombre (se reportan, no se cambian)

- `cursos` no tiene `cursos.repository.ts`. Su SQL está en `ficha.repository.ts` y en `temario/*.repository.ts`, que son sub-capas internas válidas. Además tiene `politica-curso.ts`, `puertos.ts` y `detalle-privado.service.ts`.
- `identidad` y `contenido` no tienen `.modelo.ts`; los tipos de sesión viven en `shared/auth/tipos.ts`.
- `revision` no tiene repository y usa `cursosApi`. Es correcto.
- Hay sufijos extra que se usan de forma coherente: `*.correos.ts` (en 3 módulos), `*.multipart.ts` (en 2) y `politica-*.ts`. Se recomienda añadirlos a la lista de sufijos permitidos en el README.
- `shared/http` mezcla la infraestructura HTTP con los 10 archivos `openapi*.ts` y con `salud.repository.ts`, que contiene SQL.

## 2. Tabla de cambios (aprobar o rechazar cada fila)

**F: frontend, B: backend.** En ningún caso cambia una URL visible. Los `path` quedan iguales y solo cambian `loadChildren` y `loadComponent`.

| # | Antes | Después | Afectados | Riesgo |
|---|---|---|---|---|
| F1 | `shared/ui/{toasts, toast.service, confirmacion, confirmacion.service, modal, error-carga(+spec), esqueleto, estado-vista(+spec)}` | `shared/ui/retroalimentacion/` | Unos 45 imports (`esqueleto` 13, `toast.service` 13, `confirmacion.service` 8, `modal` 7) y `app.ts` | Bajo |
| F2 | `shared/ui/{grafico-series(+spec), grafico-echarts, indicador, anillo-progreso, barra-progreso, estrellas}` | `shared/ui/datos/` | Unos 20 imports y `analiticas.spec.ts` | Bajo |
| F3 | `shared/ui/{tarjeta-curso, portada-curso, estado-curso.ts/html/scss}` | `shared/ui/cursos/` | 9 imports | Bajo |
| F4 | `shared/ui/{logo, avatar(+spec), iconos}` | `shared/ui/marca/` | Unos 21 imports, entre ellos `app.config.ts` y los specs que registran `ICONOS` | Bajo |
| F5 | `shared/ui/{carrusel, buscador-movil}` | `shared/ui/navegacion/` | 3 imports | Bajo |
| F6 | `shared/cursos/cursos.scss` | `shared/estilos/cursos.scss` | 10 líneas `@use` | Bajo |
| F7 | `layouts/{layout-panel.*, menu-panel}` y `shared/layout/*` | `layouts/panel/`, `layouts/sitio/` (sitio, header, vista previa) y `layouts/comun/` (footer, menú de cuenta, barra inferior) | `app.routes.ts` y unos 12 imports relativos entre ellos | Medio |
| F8 | `features/admin-usuarios/` (`admin-usuarios.api.ts`, `.routes.ts`) | `features/admin/usuarios/` (`usuarios.api.ts`, `usuarios.routes.ts`); la clase `AdminUsuariosApi` no cambia | `app.routes.ts` | Bajo |
| F9 | `features/admin-categorias/` | `features/admin/categorias/` (`categorias.api.ts`, `categorias.routes.ts`) | `app.routes.ts` | Bajo |
| F10 | `features/admin-resenas/` y `paginas/reportes/reportes.*` | `features/admin/resenas/` y `paginas/moderacion/moderacion.*`; la clase `ReportesResenas` pasa a `ModeracionResenas` y el selector a `app-moderacion-resenas` | `app.routes.ts`, `app.routes.spec.ts` (`pagina=ReportesResenas`) y el spec | Bajo |
| F11 | `features/revision/` | `features/admin/revision/` | `app.routes.ts` y los imports de `docente-cursos/componentes/listado-cursos` | Bajo |
| F12 | `features/usuarios/paginas/solicitudes` y `usuarios.routes.ts` | `features/admin/solicitudes/` (`solicitudes.routes.ts`) | `app.routes.ts` | Bajo |
| F13 | `features/usuarios/paginas/perfil` | `features/identidad/paginas/perfil-estudiante/`; con esto `features/usuarios/` desaparece | `identidad.routes.ts` | Bajo |
| F14 | `features/docente-cursos/` | `features/docente/cursos/` (`cursos.api.ts`, `cursos.routes.ts`); la clase `DocenteCursosApi` no cambia | Unos 15 imports (`gestion-cursos.spec`, la revisión, `estudiantes`) | Medio |
| F15 | `pages/docente/estudiantes/` y `docente-cursos/seguimiento-docente.api.ts` | `features/docente/estudiantes/paginas/estudiantes/` y `estudiantes.api.ts`; la clase `SeguimientoDocenteApi` no cambia | `app.routes.ts` y `estudiantes.spec.ts` | Bajo |
| F16 | `features/docente-resenas/` y `features/docente-analiticas/` | `features/docente/resenas/` y `features/docente/analiticas/` (los `.api.ts` y `.routes.ts` pierden el prefijo) | `app.routes.ts`, `ajustes-perfil.ts` y los specs | Bajo |
| F17 | `pages/estudiante/inicio-estudiante` y `mi-aprendizaje` | `features/aprendizaje/paginas/…` | `app.routes.ts` y `mi-aprendizaje.spec.ts` | Bajo |
| F18 | `pages/estudiante/leccion/leccion.*` (clase `Leccion`, selector `app-leccion`) | `features/aprendizaje/paginas/seguimiento-curso/seguimiento-curso.*`; la clase pasa a `SeguimientoCurso` y el selector a `app-seguimiento-curso` | `app.routes.ts` y `app.routes.spec.ts` (`pagina=Leccion`). El selector no se usa en ningún otro sitio, ni en la E2E | Bajo |
| F19 (opcional) | Rutas de aprendizaje y de estudiantes definidas dentro de `app.routes.ts` | `aprendizaje.routes.ts` y `estudiantes.routes.ts`, como pide el ADR-007 | `app.routes.ts` y `app.routes.spec.ts`; los guards se mueven de sitio | Medio |
| B1 | `shared/http/openapi*.ts` (10 archivos) | `shared/openapi/` | `app.ts` y `scripts/serializar-openapi.mts`. Ese script escribe la ruta de origen en la cabecera de `openapi.yaml`, ver la pregunta 3 | Medio |
| B2 | `shared/http/salud.repository.ts` | `shared/database/salud.repository.ts` | `app.ts` y `server.ts` | Bajo |

## 3. Árbol propuesto

```
frontend/src/app/
├── app.ts · app.config.ts · app.routes.ts (+spec)
├── core/                     (sin cambios: api/ auth/ cursos/ estado/ http/ navegacion/ solicitudes/)
├── features/
│   ├── admin/
│   │   ├── categorias/       categorias.api.ts · categorias.routes.ts · paginas/categorias/
│   │   ├── resenas/          resenas.api.ts · resenas.routes.ts · paginas/moderacion/
│   │   ├── revision/         revision.api.ts · revision.routes.ts · paginas/{revision-cursos,revision-curso}/
│   │   ├── solicitudes/      solicitudes.routes.ts · paginas/solicitudes/
│   │   └── usuarios/         usuarios.api.ts · usuarios.routes.ts · paginas/usuarios/
│   ├── docente/
│   │   ├── analiticas/       analiticas.api.ts · analiticas.routes.ts · paginas/analiticas/
│   │   ├── cursos/           cursos.api.ts · cursos.routes.ts · componentes/ · paginas/{mis-cursos,editor-curso}/
│   │   ├── estudiantes/      estudiantes.api.ts · paginas/estudiantes/
│   │   └── resenas/          resenas.api.ts · resenas.routes.ts · paginas/resenas/
│   ├── aprendizaje/          aprendizaje.api.ts · componentes/ · paginas/{inicio-estudiante,mi-aprendizaje,seguimiento-curso}/
│   ├── catalogo/  contenido/  errores/     (sin cambios)
│   └── identidad/            … paginas/{login,registro,recuperar,restablecer,ajustes-perfil,perfil-estudiante}/
├── layouts/
│   ├── comun/                footer-sitio · menu-cuenta · tab-bar
│   ├── panel/                layout-panel.{ts,html,scss} · menu-panel
│   └── sitio/                layout-sitio · header-sitio.{ts,scss} · vista-previa-aprendizaje
└── shared/
    ├── estilos/              cursos.scss
    ├── util/  validadores/   (sin cambios)
    └── ui/
        ├── tipos-ui.ts (+spec)          ← tipos comunes de UI (Tono, iconos de categoría)
        ├── cursos/            estado-curso.* · portada-curso · tarjeta-curso
        ├── datos/             anillo-progreso · barra-progreso · estrellas · grafico-echarts · grafico-series · indicador
        ├── marca/             avatar · iconos · logo
        ├── navegacion/        buscador-movil · carrusel
        └── retroalimentacion/ confirmacion(.service) · error-carga · esqueleto · estado-vista · modal · toast.service · toasts

backend/src/  (solo cambia shared/)
├── modules/   (sin cambios)
└── shared/
    ├── database/  pool.ts · salud.repository.ts      ← B2
    ├── openapi/   openapi.ts · openapi-comun.ts · openapi-*.ts   ← B1
    └── http/      app-error · cookies-sesion · correlacion · csv · esquemas · limite-peticiones · manejador-errores · validar
```

**Sobre `shared/ui`:** se propone agrupar por función, sin barrels (`index.ts`). Con imports directos, cada página diferida solo descarga lo que usa y se evitan ciclos entre grupos. Además, el compilador señala cada import roto al mover. Si se prefieren barrels, se puede poner uno por grupo.

## 4. Impacto en las pruebas

- **vitest:**
  - Los specs se mueven con su componente (`git mv`) y solo cambian sus imports relativos.
  - Hay que editar también `app.routes.spec.ts` (`pagina=Leccion` y `pagina=ReportesResenas`), `gestion-cursos.spec.ts`, `estudiantes.spec.ts`, `analiticas.spec.ts` y los specs que registran `ICONOS`.
- **node:test:**
  - Solo le afectan B1 y B2, y de forma indirecta, a través de `app.ts`.
  - Hay pruebas que importan internos de los módulos (`cursos.service`, `politica-curso`, `usuarios.service`). No se mueven.
- **Playwright + axe:** dependen solo de URLs y textos visibles, y ninguno cambia. Se ejecuta la suite completa después de cada lote.
- **Documentos con rutas antiguas** (se actualizan en el último lote, solo las rutas): `README.md`, `docs/adr/ADR-007` y `ADR-012`, `docs/api/COMPARACION_RUTAS.md` y `SPRINT3_APRENDIZAJE_ENTREGA.md`. Los de `docs/refactor/` son historial y no se tocan.

## 5. Plan de la Fase 2

- **Rama:** `sprint4/elian-estructura`, creada desde `sprint4/elian` con el árbol limpio.
- **Lotes:**
  1. `shared/ui` y `shared/estilos` (F1–F6).
  2. Layouts (F7).
  3. Administración (F8–F13).
  4. Docente (F14–F16).
  5. Aprendizaje y seguimiento del curso (F17–F19).
  6. Backend (B1–B2).
- **Dos commits por lote:** primero solo `git mv`, luego la edición de imports, selectores y clases. El primer commit no compila por sí solo; es lo esperado con esa regla.
- **Después de cada lote:** `tsc`, `ng build`, `vitest`, `node:test` y la E2E completa. Si algo falla, se corrige o se revierte el lote.

## 6. Hallazgos que no se moverán

- **`core/auth/demo-sesiones.ts`:** es el modo demostración, desactivado por defecto pero todavía cargado por `auth.service.ts`. ¿Se quita más adelante?
- **`core/cursos/gestion-cursos.model.ts`:** son tipos escritos a mano que el ADR-007 decía sustituir por los de `core/api`. Es trabajo pendiente, no un movimiento.
- **`core/solicitudes/solicitudes-docente.service.ts`:** lo usan dos features (el perfil del estudiante y la administración), así que está bien en `core/`.
- **`features/contenido/youtube-api.ts`:** su nombre parece un cliente HTTP, pero carga el SDK de YouTube. Renombrarlo a `youtube-sdk.ts` es opcional.

## 7. Preguntas

1. **`revision` frente a `resenas`** (el "review/reviews" del prompt): no se pisan.
   - `revision` es el flujo de aprobación de cursos antes de publicarlos.
   - `resenas` son las valoraciones de los estudiantes y la moderación de los reportes.
   - Se recomienda dejarlos como están y añadir una línea en cada `index.ts` que lo aclare. La alternativa es renombrar `revision` a `revision-cursos` en el backend y el frontend. ¿Cuál se prefiere?
2. **¿Se mantienen los nombres en español?** Se recomienda que sí.
3. **B1 y `openapi.yaml`:** al mover los archivos, la cabecera del YAML cambia una línea de comentario (la ruta de origen), y `api:verificar` exigiría regenerarlo. ¿Se aprueba regenerar solo esa línea o se omite B1?
4. **Título de la pestaña en F18:** ¿se mantiene "Lección · Learnity"? Se recomienda que sí, porque la URL sigue apuntando a una lección concreta.
5. **Clases de las APIs:** en F8–F16 se propone renombrar solo los archivos y mantener los nombres de clase (`AdminUsuariosApi`, `DocenteCursosApi`…). ¿De acuerdo?
6. **¿Se incluye F19** (archivos de rutas propios, como pide el ADR-007)?
7. **Momento:** el equipo acaba de recibir `sprint4`. Con más de 150 archivos movidos, sus cambios en curso chocarán con los imports nuevos. Git sigue los renombrados al fusionar, pero los imports editados darán conflictos. Se recomienda hacerlo antes de que empiecen, o acordar un momento sin trabajo abierto.

**Para aprobar:** indicar las filas aprobadas (por ejemplo, "todo salvo B1 y F19") y las respuestas a las preguntas.
