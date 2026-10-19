# ADR-004: Ruptura del ciclo Cursos ⇄ Contenido mediante un puerto

- **Estado:** Propuesto
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:** No

## Contexto

Cursos y Contenido se importan mutuamente (A3):

| Sentido | Qué se usa | Dónde |
|---|---|---|
| Cursos → Contenido | `limpiezaPdfService.retirarPdfSinUso(cliente, idCurso, ids)` dentro de la transacción de eliminar lección y módulo, y `limpiarPendientes()` después del `COMMIT` | `cursos.service.ts:19-21, 746, 761, 844, 859` |
| Contenido → Cursos | `verificarCarga`, `conLeccionEditable`, `asociarPdfPrincipal`, `detallePrivado` y `autorizarLectura` (todos definidos en `cursos-integracion.service.ts:430-529` y expuestos por el `...cursosIntegracionService` de `cursos.service.ts:105-106`) | `contenido.service.ts:19-21, 53, 89, 145, 172, 221` |

Además:
- Administración usa `cursosService.listarParaRevision`, `detalleParaRevision` y `decidirRevision` (`administracion.service.ts:31-47`).
- `test/administracion-contenido.test.ts:886-902` sustituye `cursosService.asociarPdfPrincipal` en caliente para simular un fallo. Funciona porque Contenido llama a través de la propiedad del objeto (enlace tardío).

El ciclo impide que `be-b` divida Cursos sin tocar Contenido, y viola la regla "solo se importa el `index.ts` de otro módulo" (ADR-001). La propia aplicación ya resolvió un caso igual con el patrón **registrar al arrancar**: `shared/auth/middlewares.ts:13-15` define `registrarVerificadorSesion` y `app.ts:32` le pasa la implementación de Identidad.

## Decisión propuesta

**El sentido natural es Contenido → Cursos.** Contenido necesita las reglas del curso (propiedad, estado editable y detalle). Cursos solo necesita una cosa de Contenido: "libera los archivos de estas lecciones que se van a borrar". Por eso **Cursos define el puerto y Contenido lo implementa**.

```ts
// modules/cursos/puertos.ts (exportado desde cursos/index.ts)
import type { PoolClient } from 'pg';

/** Lo que Cursos necesita de quien guarda los archivos de las lecciones. */
export interface LiberadorArchivos {
  /** Dentro de la transacción del borrado: marca los archivos que quedan sin uso. */
  retirarSinUso(cliente: PoolClient, idCurso: number, idsArchivo: number[]): Promise<void>;
  /** Después del COMMIT: borra físicamente lo pendiente. Devuelve cuántos borró. */
  limpiarPendientes(): Promise<number>;
}

let liberador: LiberadorArchivos | null = null;
export function registrarLiberadorArchivos(l: LiberadorArchivos): void { liberador = l; }
export function liberadorArchivos(): LiberadorArchivos {
  if (!liberador) throw new Error('LiberadorArchivos no registrado: revisa crearApp().');
  return liberador;
}
```

- **Contenido** exporta `liberadorArchivos` (el actual `limpiezaPdfService`, adaptado a la interfaz) desde su `index.ts` y llama a Cursos solo a través de `cursos/index.ts`: `cursosApi.verificarCarga`, `conLeccionEditable`, `asociarPdfPrincipal`, `detallePrivado` y `autorizarLectura`.
- **`app.ts`** (de `be-a`), junto a `registrarVerificadorSesion`: `registrarLiberadorArchivos(contenido.liberadorArchivos)`.
- **Si falta el registro, falla rápido** con un `Error` (500). No se ignora en silencio, porque si no, se perderían borrados físicos.
- **Las pruebas** que llaman a los servicios sin pasar por HTTP registran el puerto en su preparación (o llaman a `crearApp()`, que lo registra, como ya hacen hoy `administracion-contenido.test.ts`, `cursos-gestion-http.test.ts` y otras). La sustitución de `asociarPdfPrincipal` sigue funcionando si Contenido llama a través del objeto público de Cursos, no de una función desestructurada.
- **Se conservan intactos** el orden transaccional actual (marcar dentro de la transacción y borrar después del `COMMIT`) y el `console.warn` de reintento (este último cambia al logger del ADR-006 sin cambiar el comportamiento).
- **Revisión** (antes Administración) consume `cursos/index.ts` (`listarParaRevision`, `detalleParaRevision` y `decidirRevision`). No necesita puerto, porque no hay ciclo.

## Opciones consideradas

### Opción A: puerto definido por Cursos e implementado por Contenido (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja (una interfaz con 2 métodos y una función de registro) |
| Riesgo de regresión | Bajo: el comportamiento es idéntico y las pruebas existentes lo cubren |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta: es el mismo patrón que `registrarVerificadorSesion` |

**A favor:** el puerto es mínimo (2 métodos frente a 5 en el otro sentido); sigue un patrón que el equipo ya conoce. **En contra:** el registro ocurre al arrancar; si se olvida, el error aparece la primera vez que se borra algo (mitigado con el fallo rápido y las pruebas).

### Opción B: puerto definido por Contenido e implementado por Cursos

| Dimensión | Valoración |
|---|---|
| Complejidad | Media (interfaz de 5 métodos con `PoolClient` y genéricos) |
| Riesgo de regresión | Medio |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Media |

**A favor:** también rompe el ciclo. **En contra:** invierte la dependencia que Contenido necesita de verdad, y el puerto sería grande y estaría acoplado a los detalles del curso.

### Opción C: eventos en proceso (`EventEmitter`, "lección eliminada")

| Dimensión | Valoración |
|---|---|
| Complejidad | Media |
| Riesgo de regresión | **Alto:** `retirarSinUso` debe correr *dentro* de la transacción del borrado; un evento asíncrono rompería esa atomicidad |
| Impacto en el contrato | Ninguno, en teoría |
| Familiaridad del equipo | Media |

**A favor:** desacopla del todo. **En contra:** pierde la garantía transaccional y hace más difícil seguir el flujo.

### Opción D: fusionar Cursos y Contenido en un solo módulo

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Bajo |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta |

**A favor:** el ciclo desaparece. **En contra:** crea un módulo de unas 3 300 líneas, contrario a A1 y A2, y mezcla el almacenamiento de archivos con las reglas del curso.

### Opción E: mover la limpieza a `shared/archivos`

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Bajo |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta |

**A favor:** Cursos dejaría de importar Contenido. **En contra:** `limpiarPendientes` usa el repositorio de Contenido (la tabla `archivo_borrado_pendiente`). Llevarlo a `shared` metería SQL de dominio en `shared` y rompería la regla de capas.

## Análisis de compromisos

A es la opción más pequeña que respeta la atomicidad (a diferencia de C), no mezcla responsabilidades (a diferencia de D y E) y reutiliza un patrón que el equipo ya conoce. B funcionaría, pero con un puerto cinco veces más grande y en el sentido equivocado.

## Consecuencias

- **Más fácil:**
  - `be-b` divide Cursos (ficha y `temario/`) sin tocar Contenido;
  - en el futuro, otro almacenamiento solo implementaría `LiberadorArchivos` (ADR-005), sin nada del Sprint 3 ahora.
- **Más difícil:**
  - `app.ts` tiene un registro más;
  - las pruebas que usan los servicios sin `crearApp()` deben registrar el puerto.
- **A revisar:** si aparecen más puertos, agrupar los registros en una función `registrarPuertos()` dentro de `app.ts`.

## Acciones

1. [ ] Caracterización del borrado de lecciones y módulos con PDF (marcado, borrado físico después del `COMMIT` y reintento) (`qa-edge`, Fase 2A; ya cubierto en parte por `administracion-contenido.test.ts:1440-1491`).
2. [ ] `cursos/puertos.ts`, y exportarlo en `cursos/index.ts` (`be-b`, Fase 2B, B3).
3. [ ] Contenido implementa y exporta `liberadorArchivos`; deja de importar `cursos.service.js` y usa `cursos/index.js` (`be-b`, B3).
4. [ ] `app.ts` registra el puerto (`be-a`, a petición de `be-b`).
5. [ ] Ajustar los imports de `administracion-contenido.test.ts` sin cambiar expectativas (`be-b`).

## Cómo se verifica

```bash
# Ni Cursos importa Contenido ni nadie importa archivos internos de Cursos (ambos vacíos):
grep -rn "from '\.\./contenido/" backend/src/modules/cursos
grep -rnE "from '\.\./cursos/[a-zA-Z.-]+\.js'" backend/src/modules | grep -v "/index\.js'"
# El puerto se registra al arrancar:
grep -n "registrarLiberadorArchivos" backend/src/app.ts
```

Además: suite y caracterización en verde, y `openapi.yaml` sin cambios.
