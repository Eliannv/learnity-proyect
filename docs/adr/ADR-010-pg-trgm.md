# ADR-010: Extensión candidata `pg_trgm` (D9)

- **Estado:** Propuesto. Es una de las tres candidatas de D9 = A; el usuario la aprueba o la rechaza en la Puerta 1.
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`; la migración, si se aprueba, es de `db`
- **Cambia el contrato:** No (Opción B). La Opción C sí lo cambiaría.
- **Recomendación:** **aplazar** (Opción A) hasta que haya datos que lo justifiquen. Debajo se razona.

## Contexto

- La búsqueda del catálogo (`GET /api/cursos?q=`) hace `ILIKE '%q%' ESCAPE '\'` sobre `curso.titulo`, `curso.subtitulo` y `curso.descripcion`, con `OR` y siempre con `estado = 'PUBLICADO'` (`cursos.repository.ts:47-67`).
- Un patrón con `%` al principio no puede usar un índice B-tree, así que cada búsqueda recorre los cursos publicados.
- `pg_trgm` permite índices GIN o GiST (`gin_trgm_ops`) que sí aceleran `ILIKE '%q%'` cuando el patrón tiene 3 o más caracteres.
- Volumen actual: la base local tiene pocos cursos (las semillas del Sprint 2 y los de prueba). El número exacto en `Learnity` está **NO VERIFICADO** en este ADR (es un dato de `db`). El catálogo pagina como mucho 50 resultados por petición.
- Desde PostgreSQL 13, `pg_trgm` es una extensión *trusted*: la puede crear el dueño de la base sin ser superusuario. Viene en los módulos `contrib` del instalador de PostgreSQL 17. Que esté disponible en el servidor local está **NO VERIFICADO**: se comprueba con `SELECT * FROM pg_available_extensions WHERE name = 'pg_trgm'`.
- Por D7, el DDL lo ejecuta el usuario con los scripts que prepare `db`.

## Decisión propuesta

**Opción A: aplazar.** No se instala la extensión en este refactor. Se documenta un umbral para reconsiderarlo: más de 10 000 cursos publicados, o un p95 de `GET /api/cursos?q=` por encima de 200 ms medido en local con `EXPLAIN (ANALYZE, BUFFERS)`. Si el usuario prefiere tenerla ya, se aplica la **Opción B**, tal como se describe, en una migración **separada y opcional** de `db`.

## Opciones consideradas

### Opción A: no indexar por ahora (recomendada)

| Dimensión | Valoración |
|---|---|
| Complejidad | Nula |
| Riesgo | Nulo |
| Impacto en el contrato | Ninguno |
| Coste | Ninguno |

**A favor:** con el volumen actual, un recorrido de la tabla `curso` cuesta menos que mantener tres índices GIN; no añade una extensión a la base ni pasos al procedimiento de cada integrante. **En contra:** si el catálogo crece mucho, la búsqueda se degrada de forma lineal.

### Opción B: `pg_trgm` con tres índices GIN

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX curso_titulo_trgm_idx      ON curso USING gin (titulo gin_trgm_ops);
CREATE INDEX curso_subtitulo_trgm_idx   ON curso USING gin (subtitulo gin_trgm_ops);
CREATE INDEX curso_descripcion_trgm_idx ON curso USING gin (descripcion gin_trgm_ops);
-- down: DROP INDEX … ; DROP EXTENSION IF EXISTS pg_trgm;
```

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja-media (migración `up`/`down` y la extensión en cada base local) |
| Riesgo | Bajo: no cambia los resultados, solo el plan |
| Impacto en el contrato | Ninguno (mismo `ILIKE` y mismos resultados) |
| Coste | Escrituras en `curso` algo más lentas; espacio de los índices; con pocos datos, el planificador seguirá eligiendo el recorrido completo |

**A favor:** acelera la búsqueda con patrones de 3 o más caracteres sin tocar el código. Con el ADR-002, los índices van sobre la tabla `curso` y la vista los aprovecha. **En contra:** no ayuda con patrones de 1 o 2 caracteres; hoy no habría ninguna mejora medible; es un paso más para cada integrante.

### Opción C: búsqueda de texto completo (`tsvector`, configuración `spanish`)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media |
| Riesgo | **Alto para el contrato** |
| Impacto en el contrato | **Sí**: cambia qué cursos coinciden (lematización, palabras vacías, sin subcadenas), y por tanto los resultados de `q` |
| Coste | Columna generada o índice de expresión |

**A favor:** búsqueda por palabras con orden por relevancia. **En contra:** es un cambio funcional, no un refactor; necesitaría su propio ADR y la aprobación del usuario.

### Opción D: `unaccent` (con o sin trigramas)

**Cambia los resultados** (una búsqueda de "programacion" encontraría "Programación"): es funcionalidad nueva. Fuera de alcance.

## Análisis de compromisos

B no cambia nada que se vea desde fuera y es reversible, pero hoy su beneficio es nulo y añade mantenimiento. C y D serían mejoras de producto, no de refactor. Por eso se recomienda A con un umbral medible, y B queda preparada por si el usuario prefiere tenerla ya.

## Consecuencias

- **Si A:** nada cambia. Se anota el umbral en `PLAN_BD.md` (`db`).
- **Si B:** `db` añade una migración opcional y separada, probada `up → down → up` en `learnity_test`; cada integrante la aplica en su base; el README documenta la extensión.

## Acciones

1. [ ] El usuario decide A o B en la Puerta 1.
2. [ ] Si B: `db` comprueba `pg_available_extensions` en `learnity_test`, escribe la migración y anota el plan antes y después con `EXPLAIN ANALYZE`.

## Cómo se verifica (si B)

`EXPLAIN (ANALYZE) SELECT … WHERE titulo ILIKE '%algo%'` sobre `learnity_test` con datos sintéticos muestra un `Bitmap Index Scan` sobre los índices `*_trgm_idx`, y la caracterización del catálogo sigue en verde.
