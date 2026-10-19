# ADR-005: Strategy de transporte de correo e interfaz de almacenamiento

- **Estado:** Aceptado (19-10-2026, Puerta 1, decisión P1-1), con sus dos decisiones: 5.1 correo y 5.2 almacenamiento
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:** No
- **Fuera de alcance:** video, PowerPoint, almacenamiento en la nube y validadores por tipo de archivo (Sprint 3/4). Este ADR **no** crea implementaciones para ellos.

## Contexto

**Correo (A8).** `shared/correo/correo.ts:19-28` elige el transporte con un `if (env.CORREO_TRANSPORTE === 'gmail')`. La rama de Gmail delega en `gmail.ts:68`; la del buzón (escribir un JSON en `BUZON_DIR`) está en línea en la misma función. La configuración ya restringe los valores (`env.ts:49`: `z.enum(['gmail', 'buzon'])`) y obliga a usar `gmail` en producción (`env.ts:63-65`). Hay dos consumidores, los dos en Identidad (`identidad.service.ts:118, 296`), y las pruebas usan el buzón.

**Almacenamiento (A9).** `shared/archivos/almacen-pdf.ts:61-160` es un objeto concreto (`almacenPdf`) con `guardar(nombre, bytes)`, `leer(nombre, tamanoEsperado)`, `esValido(nombre, tamano)` y `eliminar(nombre)`, sobre el disco local (`PDF_DIR`). Lo usan:
- Contenido: `contenido.service.ts:132, 227` y `contenido-limpieza.service.ts:46`;
- **Cursos**: `cursos-integracion.service.ts:338`, `esValido` dentro de una transacción con filas bloqueadas (A5, riesgo R4);
- `test/administracion-contenido.test.ts` (8 referencias).

La regla del equipo (§4.13) permite polimorfismo solo donde elimine un `if/switch` por tipo o una duplicación, y con un ADR.

## Decisión propuesta

### 5.1 Correo: Strategy elegida una sola vez al arrancar

```ts
// shared/correo/transporte.ts
export interface TransporteCorreo { enviar(correo: Correo): Promise<void> }

// shared/correo/gmail.ts → export const transporteGmail: TransporteCorreo
// shared/correo/buzon.ts → export const transporteBuzon: TransporteCorreo  (código actual de la rama buzón, sin cambios)

const TRANSPORTES: Record<Env['CORREO_TRANSPORTE'], TransporteCorreo> = { gmail: transporteGmail, buzon: transporteBuzon };
export const enviarCorreo = (correo: Correo) => TRANSPORTES[env.CORREO_TRANSPORTE].enviar(correo);
```

- La firma pública `enviarCorreo(correo)` no cambia, así que Identidad no se toca.
- El `if` desaparece: el `Record` tipado obliga a que cada valor del `enum` de `env.ts` tenga su transporte (el compilador falla si falta uno).
- Sin dependencias nuevas (ni `nodemailer` ni contenedores de inyección).

### 5.2 Almacenamiento: interfaz con una única implementación local

```ts
// shared/archivos/almacen.ts
export interface AlmacenArchivos {
  guardar(nombre: string, bytes: Buffer): Promise<void>;
  leer(nombre: string, tamanoEsperado: number): Promise<Buffer>;
  existeYCoincide(nombre: string, tamano: number): Promise<boolean>; // hoy: esValido (lee y valida el PDF)
  eliminar(nombre: string): Promise<void>;
}
export const almacenLocal: AlmacenArchivos = { /* el código actual de almacenPdf, sin cambios */ };
```

- **Solo hay una implementación** (disco local, `PDF_DIR`). No hay fábrica, ni selección por configuración, ni implementaciones vacías "para después".
- La validación del contenido sigue en `pdf-validacion.ts`. **No** se crea un registro de "validadores por tipo": hoy solo existe el PDF y no hay ningún `if/switch` por tipo que eliminar.
- Para qué sirve la interfaz:
  1. los módulos dependen de un contrato y no de `fs` (Cursos deja de importar `almacen-pdf.ts`; la comprobación pasa a hacerse a través de Contenido, según el ADR-004 y el ADR-001);
  2. permite sustituir el almacén en las pruebas sin escribir en disco;
  3. deja un punto claro para el almacenamiento temporal de la subida (ADR-011, punto 11.5).
- **No resuelve por sí misma** la lectura de disco con filas bloqueadas (A5). Eso es un cambio de orden en el servicio (leer y validar antes de bloquear, o después del `COMMIT`) que hace `be-b` en B1 y B2. La interfaz solo lo hace visible.
- Se puede mantener el nombre `esValido` si se prefiere no renombrar. Lo importante es que el nombre refleje que lee el archivo, para que nadie lo llame con filas bloqueadas sin saberlo.

## Opciones consideradas

### Correo

#### Opción A: dejar el `if`

| Dimensión | Valoración |
|---|---|
| Complejidad | Nula |
| Riesgo de regresión | Nulo |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Total |

**A favor:** son 10 líneas que funcionan. **En contra:** la rama del buzón está mezclada con el despacho y no se puede probar por separado; un tercer transporte haría crecer el `if`.

#### Opción B: Strategy con un `Record` tipado (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Muy bajo (las mismas funciones, separadas) |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta |

**A favor:** elimina el `if` por tipo, que es lo que permite la regla §4.13; el compilador exige que haya un transporte por cada valor; cada transporte se prueba por separado. **En contra:** el beneficio es modesto con solo dos transportes. Es un cambio de prioridad baja.

#### Opción C: `nodemailer` con un transporte de pruebas

| Dimensión | Valoración |
|---|---|
| Complejidad | Media |
| Riesgo de regresión | Medio: cambia el envío por Gmail, que ya está probado |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Media |

**A favor:** es una librería estándar. **En contra:** es una dependencia nueva fuera de D9, reemplaza código que funciona y no aporta nada al refactor.

### Almacenamiento

#### Opción A: dejar el objeto concreto `almacenPdf`

| Dimensión | Valoración |
|---|---|
| Complejidad | Nula |
| Riesgo de regresión | Nulo |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Total |

**A favor:** no hay que hacer nada. **En contra:** Cursos sigue atado al sistema de archivos; para sustituirlo en las pruebas hay que parchear el módulo.

#### Opción B: interfaz y una sola implementación local (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Muy bajo (el mismo código, con un tipo) |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta |

**A favor:** límite claro, pruebas más sencillas y un punto de extensión para el ADR-011, sin especular. **En contra:** es una interfaz con una sola implementación; se justifica por las pruebas y por la frontera entre módulos, no por el polimorfismo.

#### Opción C: abstracción completa (proveedores local o S3, validadores por tipo y fábrica por configuración)

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta |
| Riesgo de regresión | Medio |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Baja |

**A favor:** "preparado para el futuro". **En contra:** implementa por adelantado el Sprint 3 (video y PPT), que está prohibido; añade código muerto.

## Análisis de compromisos

En los dos casos se elige la versión mínima que elimina un acoplamiento real (el `if` del correo y la dependencia de Cursos con `fs`) sin anticipar el Sprint 3. El correo es de prioridad baja: si el usuario prefiere no tocarlo, rechazar el 5.1 no afecta al resto del plan.

## Consecuencias

- **Más fácil:**
  - probar cada transporte y el almacén por separado;
  - añadir un transporte de correo o un almacén en un sprint futuro sin tocar a los consumidores.
- **Más difícil:** casi nada. Hay que mantener dos archivos más en `shared/correo`.
- **A revisar:** el almacenamiento temporal de la subida (ADR-011) usará `AlmacenArchivos` o el directorio temporal de `multer`. Se decide allí.

## Acciones

1. [ ] 5.1: separar `transporteGmail` y `transporteBuzon` y despachar con el `Record` (`be-a`, Fase 2A; `shared/correo` es suyo).
2. [ ] 5.2: crear `AlmacenArchivos` y `almacenLocal`; Contenido usa la interfaz; Cursos deja de importar `almacen-pdf.ts` (`be-b`, Fase 2A para `shared/archivos` y 2B para los módulos).
3. [ ] Ajustar los imports de `administracion-contenido.test.ts` sin cambiar expectativas (`be-b`).

## Cómo se verifica

```bash
grep -n "CORREO_TRANSPORTE ===" backend/src/shared/correo/*.ts      # vacío
grep -rn "almacen-pdf\|almacenPdf" backend/src/modules/cursos        # vacío
```

Además: `identidad.test.ts` (que usa el buzón) y `administracion-contenido.test.ts` en verde sin cambiar expectativas, y `openapi.yaml` sin cambios.
