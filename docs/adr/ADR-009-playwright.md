# ADR-009: Dependencia candidata `@playwright/test` (D9)

- **Estado:** Propuesto. Es una de las tres candidatas de D9 = A; el usuario la aprueba o la rechaza en la Puerta 1.
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`, para `qa-edge`
- **Cambia el contrato:** No
- **Dónde iría:** ver "Ubicación del `package.json`". **No se añade nada hasta que se apruebe.**

## Contexto

- La auditoría (§2.5-a) marca el recorrido completo como *Parcial*: no hay ninguna prueba de punta a punta que recorra "docente crea y envía → ADMIN aprueba → aparece en el catálogo".
- Hoy hay pruebas de backend con `node:test` por HTTP (78 en verde) y 20 pruebas unitarias de Angular con Vitest. Ninguna ejecuta la SPA en un navegador.
- El refactor del frontend (ADR-007) mueve muchas páginas y rutas. Lo que puede romperse ahí (guards, carga diferida, interceptor, formularios, subida de PDF) no se detecta con pruebas HTTP.
- `qa-edge` es dueño de `e2e/**`. La regla de archivos compartidos dice que los `package.json` son de `arquitecto`.
- Restricciones:
  - las pruebas solo se ejecutan contra `learnity_test`, una suite a la vez y con turno del lead;
  - hoy no hay CI: todo se ejecuta en local, en Windows.

## Decisión propuesta

**Aceptar `@playwright/test` solo para una suite e2e pequeña** de recorridos críticos que no se pueden cubrir por HTTP:
1. inicio y cierre de sesión, guards por rol y restauración de la sesión al recargar;
2. el recorrido docente → ADMIN → catálogo, incluida la subida real de un PDF;
3. el catálogo público: filtros, paginación y 404 de un borrador;
4. las solicitudes de docente (estudiante → ADMIN).

Todo lo que se pueda probar por HTTP se queda en `node:test` (`qa-edge` separa las dos cosas en `PLAN_PRUEBAS.md`). Solo se usa **Chromium**; no hay una matriz de navegadores.

### Ubicación del `package.json`

| Opción | Pros | Contras |
|---|---|---|
| **`e2e/package.json` propio (recomendada)** | No toca las dependencias del frontend ni del backend; se instala aparte (`cd e2e && npm ci`); los navegadores solo se descargan para quien ejecute e2e | **Excepción de propiedad:** `e2e/**` es de `qa-edge`, pero los `package.json` son de `arquitecto` |
| `frontend/package.json` (`devDependencies`) | Una sola instalación | Mezcla las herramientas de e2e con la aplicación y la hace más pesada para todo el que trabaje en el frontend |
| `package.json` en la raíz | Visible desde la raíz | Hoy no existe: crearía un tercer proyecto npm y confundiría el arranque descrito en el README |

**Recomendación:** `e2e/package.json`. Si se aprueba, la excepción de propiedad (`arquitecto` añade la dependencia y `qa-edge` mantiene el resto de `e2e/**`) la registra el lead en `ESTADO.md`.

## Opciones consideradas

| Opción | Complejidad | Coste | Familiaridad | Valoración |
|---|---|---|---|---|
| A. Sin e2e, solo `node:test` por HTTP | Nula | 0 | Alta | No cubre la SPA (guards, interceptor, subida desde el formulario) |
| **B. `@playwright/test` con Chromium (recomendada)** | Media | Unos cientos de MB por la descarga del navegador; minutos por ejecución | Media | Estándar actual, con espera automática y traza; funciona bien en Windows |
| C. Cypress | Media | Parecido | Baja | Más pesado en Windows y con un modelo de ejecución diferente |
| D. Vitest en modo navegador | Media | Necesita igualmente un proveedor (Playwright o WebdriverIO) | Media | Pensado para componentes, no para recorridos con el backend real |
| E. Pruebas manuales guiadas (navegador controlado por un agente) | Baja | 0 | Alta | No son reproducibles ni sirven de red de seguridad para el refactor |

## Análisis de compromisos

El coste principal de B es operativo: la descarga del navegador, levantar el backend (contra `learnity_test`) y el frontend, y el tiempo de ejecución. Se limita con una suite corta y solo con Chromium. Sin e2e, el refactor del frontend depende de pruebas manuales.

## Consecuencias

- **Más fácil:** detectar regresiones de rutas, guards y formularios al mover las *features*; demostrar el recorrido completo del Sprint 2.
- **Más difícil:**
  - preparar los datos (la semilla de `learnity_test`) y coordinar el turno de la base;
  - el tiempo de ejecución.
- **Riesgos:**
  - pruebas inestables por esperas mal planteadas. Se mitigan con localizadores accesibles (`getByRole`) y sin `waitForTimeout`;
  - la subida de PDF crea archivos en `PDF_DIR`, así que la suite debe usar el directorio de pruebas (`uploads/pdf-test`) y limpiar al terminar.
- **Si se rechaza:** `qa-edge` cubre lo posible por HTTP y deja una lista de comprobación manual para la SPA.

## Acciones

1. [ ] Si se aprueba: el lead registra la excepción de propiedad; `arquitecto` crea `e2e/package.json` con `@playwright/test` en versión exacta (Fase 2A).
2. [ ] `qa-edge`: `playwright.config.ts` (solo Chromium, `baseURL` local) y los 4 recorridos; guarda que aborte si `DB_NAME` no termina en `_test`.

## Cómo se verifica

```bash
cd e2e && npm ci && npx playwright install chromium && npx playwright test   # con turno de learnity_test
```
