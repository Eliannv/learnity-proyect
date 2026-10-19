# ADR-001: Monolito modular en capas con API pública por módulo

- **Estado:** Propuesto
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:** No

## Contexto

El backend es un monolito Express 5 + `pg` dividido en `backend/src/modules/*` y `backend/src/shared/*`. Las capas (routes → controller → service → repository) existen, pero los límites entre módulos no están protegidos:

- **No hay una API pública por módulo.** `app.ts:11-17` importa `*.routes.ts` y además `identidad.service.ts` directamente. Los módulos se importan sus archivos internos entre sí:
  - `contenido.service.ts:19-21` importa `../cursos/cursos.service.js`;
  - `cursos.service.ts:19-21` importa `../contenido/contenido-limpieza.service.js` (ciclo A3, ver ADR-004);
  - `administracion.service.ts:9-15` importa `../cursos/cursos-privados.model.js` y `../cursos/cursos.service.js`.
- **Hay responsabilidades mezcladas:**
  - `cursos.service.ts` (994 líneas) junta el catálogo público y la gestión, y hace `...cursosIntegracionService` (`:105-106`), así que expone métodos de otro archivo como si fueran suyos (A1, A2);
  - `administracion` contiene dos dominios: la revisión de cursos y las solicitudes de docente (A4).
- **Hay nombres por persona:** `cursos-integracion.*`, `openapi-integrante2/3.ts` (A11).
- **Hay SQL fuera de los repositorios:** `app.ts:35-40` y `server.ts:36-47`, además de las semillas.
- **Las pruebas importan archivos internos:** `test/administracion-contenido.test.ts:45-74` importa `cursos.service`, `contenido.service`, `contenido-limpieza.service` y `almacen-pdf`, y en `:886-902` sustituye `cursosService.asociarPdfPrincipal` en caliente.
- **Lo que sí está bien:** `shared/` no importa ningún módulo (`grep -rn "modules/" backend/src/shared` → vacío). El patrón `registrarVerificadorSesion` (`shared/auth/middlewares.ts:13-15`) ya invierte una dependencia sin ciclos.

Fuerzas:
1. Dos parejas (Lote A: `be-a` + `fe-a`; Lote B: `be-b` + `fe-b`) van a refactorizar en paralelo sin pisarse.
2. El contrato HTTP no puede cambiar.
3. Las reglas prohíben la arquitectura hexagonal y las reescrituras.
4. El equipo conoce Express y TypeScript, no herramientas de *monorepo*.

## Decisión propuesta

**Monolito modular en capas, con un `index.ts` como única superficie pública de cada módulo.**

1. **Estructura:** la de `docs/arquitectura/PLANTILLA_MODULO.md`: `index.ts`, `<m>.routes.ts`, `<m>.controller.ts`, `<m>.service.ts`, `<m>.repository.ts`, `<m>.esquemas.ts` y `<m>.modelo.ts`. Si hay subdominios, van en subcarpetas con la misma forma (por ejemplo, `cursos/temario/`).
2. **`index.ts` exporta solo:**
   - el `Router` del módulo (`<m>Routes`);
   - la interfaz del servicio que otros módulos pueden usar (un tipo exportado y el objeto que lo implementa);
   - los tipos públicos de `<m>.modelo.ts`;
   - las funciones `registrar*` de los puertos que el módulo define (ADR-004).
   Nunca exporta el repositorio, los esquemas zod ni los controladores.
3. **Regla de imports entre módulos:** un módulo solo importa `../<otro>/index.js`. `shared/` nunca importa módulos. `app.ts` solo importa `modules/*/index.js`.
4. **Capas:**
   - el controlador hace solo HTTP: lee entradas ya validadas (ADR-006) y responde;
   - el servicio contiene las reglas de negocio, la autorización por rol **y** por propiedad, y las transacciones (`enTransaccion`);
   - el repositorio contiene todo el SQL, parametrizado. No hay lecturas de disco con filas bloqueadas.
5. **Módulos destino y dependencias permitidas.** Es un grafo sin ciclos:

```
identidad ──(registrarVerificadorSesion)──► shared/auth
catalogo      (lee vistas SQL, ADR-002; no depende de otros módulos)
categorias    (tabla categoria; CRUD en la Fase 2B, con su propio ADR)
usuarios      (solicitudes de docente; asigna el rol DOCENTE con su propio repositorio)
cursos        (ficha + temario/, política de estados ADR-003; define el puerto LiberadorArchivos)
contenido ──► cursos/index      (implementa LiberadorArchivos, ADR-004)
revision  ──► cursos/index      (rutas /admin/cursos*)
aprendizaje, evaluaciones: congelados (Sprint 3/4)
```

   `administracion` desaparece: la revisión pasa a `revision` y las solicitudes a `usuarios`.
6. **Las pruebas que hoy importan archivos internos** (`administracion-contenido.test.ts`) pasan a importar el `index.ts` del módulo, o un `index` de pruebas si hace falta. Solo cambian las rutas de import, **nunca las expectativas**. La sustitución en caliente de `asociarPdfPrincipal` debe seguir apuntando al mismo objeto que usa el consumidor (ver ADR-004).

## Opciones consideradas

### Opción A: dejarlo como está

| Dimensión | Valoración |
|---|---|
| Complejidad | Nula |
| Riesgo de regresión | Nulo hoy; alto al repartir el trabajo (cada cambio en Cursos rompe Contenido y Administración) |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Total |

**A favor:** cero esfuerzo. **En contra:** mantiene el ciclo y los imports internos, e impide trabajar en paralelo por lotes.

### Opción B: `index.ts` por módulo, regla de imports y revisión con grep (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Bajo: son movimientos de archivos con la caracterización en verde |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta: es TypeScript con ESM normal |

**A favor:** sin dependencias nuevas; los límites se ven en el código; `arquitecto` los comprueba en cada integración con comandos reproducibles. **En contra:** la regla no la impone el compilador; depende de la revisión.

### Opción C: B más un verificador automático (`eslint-plugin-boundaries` o `dependency-cruiser`)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media (configuración y una dependencia de desarrollo) |
| Riesgo de regresión | Bajo |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Baja: el backend no usa ESLint |

**A favor:** la regla se impone sola. **En contra:** es una dependencia nueva, que requiere su propio ADR (D9 no la incluye), y añade configuración que el equipo no mantiene hoy. Se puede reconsiderar en la Fase 3.

### Opción D: paquetes separados (*workspaces*) o arquitectura hexagonal

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta |
| Riesgo de regresión | Alto |
| Impacto en el contrato | Ninguno en teoría, pero obliga a una reescritura |
| Familiaridad del equipo | Baja |

**A favor:** aislamiento fuerte. **En contra:** prohibida por las reglas ("nada de arquitectura hexagonal ni de reescrituras"); desproporcionada para unas 8 000 líneas.

## Análisis de compromisos

B ofrece casi todo el beneficio de C sin añadir herramientas. El riesgo de que un import interno se cuele lo cubre la revisión de integración de `arquitecto` (lista de `PLANTILLA_MODULO.md`), que se ejecuta antes de cada Puerta 2B. D resuelve un problema que el proyecto no tiene.

## Consecuencias

- **Más fácil:**
  - repartir los lotes A y B: cada pareja solo depende de los `index.ts` de los demás;
  - revisar las dependencias con un grep;
  - documentar qué ofrece cada módulo (`CONTRATOS_SERVICIO.md`).
- **Más difícil:**
  - hay que mantener `index.ts` al día;
  - `app.ts` (de `be-a`) cambia sus imports y registra los puertos;
  - `administracion-contenido.test.ts` (de `be-b`) tiene que cambiar sus imports.
- **A revisar:** si la revisión manual deja pasar imports internos, se reconsidera la Opción C en la Fase 3.

## Acciones

1. [ ] `PLANTILLA_MODULO.md` y `CONTRATOS_SERVICIO.md` (`arquitecto`, Fase 1).
2. [ ] Actualizar `scripts/crear-modulos.mjs` a la plantilla (`be-b`, Fase 2A).
3. [ ] Crear el `index.ts` de cada módulo y que `app.ts` importe solo esos archivos (`be-a` para `app.ts` y los módulos del Lote A; `be-b` para los del Lote B; Fases 2A y 2B).
4. [ ] Repartir `administracion` entre `revision` y `usuarios`, y `cursos.service.ts` en ficha y `temario/` (Fase 2B).
5. [ ] Revisar cada integración con los comandos de "Cómo se verifica" (`arquitecto`).

## Cómo se verifica

```bash
# 1) Ningún módulo importa archivos internos de otro (debe salir vacío):
grep -rnE "from '\.\./[a-z-]+/[a-zA-Z.-]+\.js'" backend/src/modules | grep -v "/index\.js'"
# 2) shared no depende de módulos (vacío):
grep -rn "modules/" backend/src/shared
# 3) app.ts solo importa index.ts de módulos (vacío):
grep -nE "modules/[a-z-]+/[a-zA-Z.-]+\.js" backend/src/app.ts | grep -v "/index\.js'"
# 4) SQL solo en repositorios (al final solo debe salir shared/database/pool.ts):
grep -rnE "consultar[<(]|\.query[<(]" backend/src --include=*.ts | grep -v "\.repository\.ts:"
```

Con el código actual (`3c3c159`), las comprobaciones 1, 3 y 4 encuentran justo la deuda descrita:
- la 1, cuatro imports internos (`administracion.service.ts:11,15`, `contenido.service.ts:21` y `cursos.service.ts:21`);
- la 3, los 7 imports de `app.ts:11-17`;
- la 4, `app.ts:36`, `server.ts:36` y `database/seed.ts` (8 llamadas), además de `pool.ts`.

La 2 ya sale vacía.

Además: caracterización y suite en verde, sin cambiar expectativas, y `openapi.yaml` sin cambios.
