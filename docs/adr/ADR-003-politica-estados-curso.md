# ADR-003: Política de estados del curso

- **Estado:** Propuesto
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:** No. Los mensajes, los códigos (`SIN_PERMISO`, `NO_ENCONTRADO`, `CURSO_BLOQUEADO`) y los estados HTTP se conservan textualmente.

## Contexto

Cada operación de escritura del docente repite la misma cadena de guardas. En `cursos.service.ts` aparece **8 veces** (actualizar curso, crear y actualizar módulo, crear y actualizar lección, eliminar lección y módulo, y enviar a revisión), y una novena en `cursos-integracion.service.ts:33-63` (`exigirEdicion`, que usa Contenido):

1. **rol:** `if (!usuario.roles.includes('DOCENTE')) throw AppError.sinPermiso()` (14 `roles.includes` en los módulos);
2. **cargar el curso:** `cursosIntegracionRepository.base(cliente, id, bloquear)`, que añade `FOR UPDATE OF c` si `bloquear` es verdadero (`cursos-integracion.repository.ts:623`), y si no existe, `noEncontrado('Curso no disponible.')`;
3. **propiedad:** `base.idPersonaDocente !== usuario.idPersona || !base.docenteActivo` → `sinPermiso(<mensaje>)`;
4. **estado editable:** `base.estado !== 'BORRADOR' && base.estado !== 'RECHAZADO'` → `conflicto(<mensaje>, 'CURSO_BLOQUEADO')` (`'BORRADOR'` aparece en `:236, 308, 408, 516, 617, 718, 816, 904`).

**Los mensajes cambian según la operación**, y el contrato y las pruebas los pueden fijar:

| Operación | Mensaje del 403 | Mensaje del 409 `CURSO_BLOQUEADO` |
|---|---|---|
| `actualizarMiCurso` | No puedes editar este curso. | El curso no permite modificaciones. |
| `crearModulo` | No puedes modificar este curso. | Este curso no permite modificaciones. |
| `actualizarModulo` | No puedes modificar este módulo. | El curso está bloqueado. |
| `crearLeccion` | No puedes modificar este curso. | El curso no permite modificaciones. |
| `actualizarLeccion` | No puedes modificar esta lección. | El curso no permite modificaciones. |
| `eliminarLeccion` | No puedes eliminar esta lección. | El curso no permite modificaciones. |
| `eliminarModulo` | No puedes eliminar este módulo. | El curso está bloqueado. |
| `enviarCursoARevision` | No puedes enviar este curso a revisión. | Este curso ya no puede enviarse a revisión. |
| `exigirEdicion` (PDF) | No puedes modificar esta lección. | El curso ya no permite cambios. Actualiza su estado. |
| `obtenerMiCurso` (lectura) | No tienes permiso para consultar este curso. | — |
| `crearCurso` (sin curso previo) | No tienes un perfil docente activo. | — |

Las transiciones de estado están repartidas en varios sitios:
- `BORRADOR` o `RECHAZADO` → `EN_REVISION` se hace en `enviarCursoARevision`;
- `EN_REVISION` → `PUBLICADO` o `RECHAZADO` se hace en `decidirRevision` (`cursos-integracion.service.ts:531-623`);
- `ARCHIVADO` existe en el modelo, pero ninguna operación lleva a él.

## Decisión propuesta

Una **política explícita** en `modules/cursos/politica-curso.ts`, con una tabla declarativa y una función de guarda, más un ayudante de servicio que ejecuta la cadena completa:

```ts
// politica-curso.ts — sin E/S; se prueba con node:test sin base de datos.
export const ESTADOS_EDITABLES: ReadonlySet<EstadoCurso> = new Set(['BORRADOR', 'RECHAZADO']);

export const TRANSICIONES: Readonly<Record<EstadoCurso, readonly EstadoCurso[]>> = {
  BORRADOR: ['EN_REVISION'],
  RECHAZADO: ['EN_REVISION'],
  EN_REVISION: ['PUBLICADO', 'RECHAZADO'],
  PUBLICADO: [],   // archivar no existe hoy: no se añade (sería funcionalidad nueva)
  ARCHIVADO: [],
};

export interface MensajesGuarda { sinPermiso: string; bloqueado: string }

export const politicaCurso = {
  esEditable: (estado: EstadoCurso) => ESTADOS_EDITABLES.has(estado),
  puedePasar: (de: EstadoCurso, a: EstadoCurso) => TRANSICIONES[de].includes(a),
  /** Propiedad y estado; lanza exactamente los AppError de hoy. */
  exigirEditable(ctx: ContextoCurso, usuario: UsuarioSesion, m: MensajesGuarda): void { /* … */ },
};
```

```ts
// en el servicio de cursos (o en cursos/temario): un solo punto que hace rol → carga → 404 → propiedad → estado
async function cargarCursoEditable(cliente, idCurso, usuario, opciones: { bloquear: boolean; mensajes: MensajesGuarda }): Promise<ContextoCurso>
```

- Cada operación declara sus mensajes **una vez**, en una constante (`MENSAJES.actualizarModulo = { sinPermiso: 'No puedes modificar este módulo.', bloqueado: 'El curso está bloqueado.' }`), y así se conservan los textos actuales sin cambiar ninguno.
- **Se mantiene la comprobación de rol en el servicio**, además de `autorizar('DOCENTE')` en la ruta. La regla del equipo exige autorizar por rol **y** por propiedad en el servicio. Lo que cambia es que se escribe una sola vez.
- El orden de las comprobaciones se mantiene. En particular, en módulos y lecciones se vuelve a leer la entidad después de bloquear el curso (`cursos.service.ts:418-430`), lo que evita carreras ya probadas (`cursos-gestion-http.test.ts:497`).
- `decidirRevision` y `enviarCursoARevision` consultan `politicaCurso.puedePasar` en vez de comparar cadenas.
- La regla de la base de datos (`CHECK` de `PUBLICADO` con revisor y fecha, de `db`) **complementa** la política: es la última defensa y no sustituye los mensajes 409 de la aplicación.

## Opciones consideradas

### Opción A: solo una función ayudante (`exigirCursoEditable`)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Bajo |
| Impacto en el contrato | Ninguno (si recibe los mensajes) |
| Familiaridad del equipo | Alta |

**A favor:** elimina la duplicación con muy poco código. **En contra:** las transiciones siguen dispersas como comparaciones de cadenas en dos servicios.

### Opción B: patrón State (una clase por estado, con `editar()`, `enviar()` y `aprobar()`)

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta (5 clases e instanciación por fila) |
| Riesgo de regresión | Medio: reescribe el flujo de todas las operaciones |
| Impacto en el contrato | Ninguno si se hace bien |
| Familiaridad del equipo | Media |

**A favor:** es el polimorfismo "de libro". **En contra:** el único comportamiento que varía por estado es "permitido o no". Cinco clases para una tabla de dos columnas es sobreingeniería, y las reglas del equipo lo desaconsejan.

### Opción C: tabla declarativa más función de guarda y ayudante de carga (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja-media |
| Riesgo de regresión | Bajo con la caracterización en verde |
| Impacto en el contrato | Ninguno (mensajes por operación) |
| Familiaridad del equipo | Alta |

**A favor:** elimina las 9 cadenas; las transiciones quedan en un solo lugar y se pueden probar sin base de datos; los mensajes quedan como datos. **En contra:** hay que llevar los mensajes por operación. Su variedad es un defecto heredado; unificarlos cambiaría textos y se deja para otro ADR, si se quiere.

### Opción D: imponer los estados solo en la base de datos (triggers o `CHECK`)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media |
| Riesgo de regresión | Alto: los errores llegarían como `23514` y hoy se convierten en 400, no en 409 `CURSO_BLOQUEADO` |
| Impacto en el contrato | **Sí** (códigos y mensajes) |
| Familiaridad del equipo | Baja |

**A favor:** la regla se cumple aunque haya otro cliente SQL. **En contra:** cambia el contrato. Sirve como complemento (el `CHECK` de `db`), no como sustituto.

## Análisis de compromisos

C añade a A una tabla de transiciones que cuesta poco y quita las comparaciones de cadenas restantes, sin el coste de B. D no cumple la condición de "contrato sin cambios". Mantener los mensajes por operación es menos elegante, pero es lo único compatible con la regla de no cambiar el contrato.

## Consecuencias

- **Más fácil:**
  - añadir una operación de escritura: se declaran sus mensajes y se llama a `cargarCursoEditable`;
  - probar las reglas de estado con pruebas unitarias;
  - dividir `cursos.service.ts` en ficha y `temario/` (B1 y B2), porque ambos usan la misma política;
  - que Contenido use la misma regla a través de la API pública de Cursos (ADR-004).
- **Más difícil:** quien quiera cambiar un mensaje tiene que ir a la tabla de mensajes. Es deliberado: es contrato.
- **A revisar:**
  - unificar los mensajes 403 y 409 (cambio de contrato, con su propio ADR);
  - si algún día se implementa el archivado (Sprint posterior), solo cambia `TRANSICIONES`.

## Acciones

1. [ ] La caracterización (`qa-edge`, Fase 2A) fija el código y el mensaje del 403 y del 409 de cada operación de la tabla.
2. [ ] `politica-curso.ts` con pruebas unitarias de `TRANSICIONES` y `exigirEditable` (`be-b`, Fase 2B, B1).
3. [ ] Sustituir las 9 cadenas por `cargarCursoEditable` y `exigirEditable` (`be-b`, B1, B2 y B3).

## Cómo se verifica

```bash
# 'BORRADOR' y 'RECHAZADO' solo aparecen en la política (y en los tipos del modelo):
grep -rn "'BORRADOR'\|'RECHAZADO'" backend/src/modules/cursos backend/src/modules/contenido --include=*.ts \
  | grep -v "politica-curso.ts\|\.modelo\.ts\|privados.model.ts"
# Comprobaciones de rol en servicios de cursos: solo dentro de la política o del ayudante
grep -rn "roles.includes" backend/src/modules/cursos
```

Además: la caracterización y `cursos-gestion*.test.ts` / `administracion-contenido.test.ts` en verde sin cambiar expectativas, y `openapi.yaml` sin cambios.
