# ADR-008: Dependencia candidata `openapi-typescript` (D9)

- **Estado:** Propuesto. Es una de las tres candidatas de D9 = A; el usuario la aprueba o la rechaza en la Puerta 1.
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:** No
- **Dónde iría:** `devDependencies` de `frontend/package.json` (de `arquitecto`). **No se añade nada hasta que se apruebe.**

## Contexto

- El ADR-007 pide un cliente HTTP tipado en `frontend/src/app/core/api/`.
- Hoy los tipos de la API están escritos a mano y duplicados en `core/cursos/gestion-cursos.model.ts` (101 líneas), `pages/publico/cursos-publicos.service.ts`, `core/auth/sesion.model.ts` y `core/solicitudes/solicitudes-docente.service.ts`. Ninguno se deriva de `docs/api/openapi.yaml`.
- Si el backend cambia un campo, el frontend compila igual y falla en tiempo de ejecución.
- El contrato es OpenAPI 3.0.3, con 33 operaciones y 15 esquemas, guardado como JSON dentro de un `.yaml`.

## Decisión propuesta

**Aceptar `openapi-typescript`** (versión 7.x, la última estable en la fecha de aprobación, con versión exacta en `package-lock.json`) **solo como generador de tipos en tiempo de desarrollo**:

- Script en `frontend/package.json`: `"api:tipos": "openapi-typescript ../docs/api/openapi.yaml -o src/app/core/api/generado/esquema.d.ts"`.
- El archivo generado **se versiona** (un `.d.ts` no tiene coste en tiempo de ejecución). `core/api/contrato.ts` reexporta alias legibles (`CursoDetalle`, `ErrorApi`, etc.).
- Las llamadas siguen usando `HttpClient` de Angular. **No** se adopta `openapi-fetch` ni ningún cliente que genere código ejecutable.
- La revisión de integración comprueba que el archivo generado está al día: `npm run api:tipos && git diff --exit-code src/app/core/api/generado`.
- **Requisito previo:** cerrar en `openapi*.ts` los hallazgos de documentación C-08 a C-11 y C-18 (`COMPARACION_RUTAS.md`). Si no, se generan tipos laxos (opcionales) y con nombres por integrante.

## Opciones consideradas

| Opción | Complejidad | Coste en ejecución | Riesgo | Familiaridad | Valoración |
|---|---|---|---|---|---|
| A. Tipos a mano en `core/api/contrato.ts` | Baja | 0 | Medio: se desalinean en silencio | Alta | Sin dependencias; se mantiene a mano y puede divergir del contrato |
| **B. `openapi-typescript` (solo tipos)** | Baja | 0 (solo `.d.ts`) | Bajo | Media | Una sola dependencia de desarrollo, sin código en ejecución; encaja con `HttpClient` |
| C. `ng-openapi-gen` u `orval` (servicios Angular generados) | Media | Sí (servicios generados) | Medio: sustituye los `*.api.ts` escritos a mano y sus nombres | Baja | Más automatización, pero impone su estructura sobre las *features* del ADR-007 |
| D. `openapi-generator-cli` | Alta | Sí | Medio | Baja | Requiere Java en cada máquina; el código generado es voluminoso |

**A favor de B:**
- un desajuste entre el backend y el frontend pasa a ser un error de compilación;
- elimina unas 150 líneas de tipos duplicados;
- no añade nada al *bundle*.

**En contra de B:**
- es una dependencia de desarrollo más (con sus dependencias transitivas), que hay que mantener actualizada;
- obliga a que `openapi*.ts` sea preciso (lo cual también es una ventaja).

## Análisis de compromisos

A cuesta 0 en dependencias, pero mantiene el problema que motiva el ADR-007. C y D generan código en tiempo de ejecución que entra en conflicto con la estructura por *features* y con la regla de que los componentes de presentación no inyectan servicios HTTP. B es el punto medio: el contrato manda en los tipos y el equipo sigue escribiendo sus `*.api.ts`.

## Consecuencias

- **Más fácil:** detectar las rupturas del contrato al compilar (`ng build`); quitar los modelos escritos a mano.
- **Más difícil:**
  - hay que regenerar los tipos tras cada cambio de `openapi*.ts`;
  - `openapi.yaml` se regenera desde `openapi*.ts` (procedimiento de `COMPARACION_RUTAS.md`), así que la cadena queda `openapi*.ts` → `openapi.yaml` → `esquema.d.ts`.
- **Si se rechaza:** `fe-b` escribe los tipos a mano en `core/api/contrato.ts`, y cada tipo cita su esquema del contrato (ADR-007, punto 2).
- **NO VERIFICADO:** que `openapi-typescript` lea sin problemas el `openapi.yaml` actual (JSON con una cabecera de comentarios `#`). Se comprueba al instalarlo; si fallara, se le pasa la versión sin cabecera.

## Acciones

1. [ ] Si se aprueba: `arquitecto` lo añade en `frontend/package.json` con el script `api:tipos` (Fase 2A).
2. [ ] Cerrar C-08 a C-11 y C-18 en `openapi*.ts` antes de la primera generación (`arquitecto`, Fase 2A).
3. [ ] `fe-b` crea `core/api/contrato.ts` a partir del archivo generado.

## Cómo se verifica

```bash
cd frontend && npm run api:tipos && git diff --exit-code src/app/core/api/generado && npx ng build
```
