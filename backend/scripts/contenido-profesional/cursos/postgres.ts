import type { Curso } from '../tipos.js';

export const postgres: Curso = {
  clave: 'postgres',
  titulo: 'Optimización de Consultas SQL y Concurrencia en PostgreSQL / Supabase',
  subtitulo: 'Lee planes de ejecución, diseña índices que se usan de verdad y controla la concurrencia sin bloqueos innecesarios.',
  descripcion:
    'Curso avanzado para desarrolladores y analistas que operan PostgreSQL en producción, ya sea autogestionado o sobre ' +
    'Supabase. Aprenderás a interpretar EXPLAIN ANALYZE, a elegir entre índices B-tree, GIN, BRIN y parciales, a ' +
    'razonar sobre MVCC y niveles de aislamiento, y a operar con seguridad una base compartida mediante Row Level ' +
    'Security, pooling de conexiones y mantenimiento con VACUUM.',
  nivel: 'AVANZADO',
  categoria: 'Bases de Datos',
  autor: 'ana.torres@learnity.com',
  nombreAutor: 'Ana Torres',
  publicadoHaceDias: 102,
  objetivos: [
    'Interpretar planes de ejecución con EXPLAIN (ANALYZE, BUFFERS)',
    'Diseñar índices compuestos, parciales y de expresión según los patrones de consulta',
    'Explicar MVCC y elegir el nivel de aislamiento adecuado para cada transacción',
    'Detectar y resolver bloqueos e interbloqueos',
    'Operar Supabase con RLS, pooling y mantenimiento planificado',
  ],
  requisitos: [
    'SQL intermedio: JOIN, agregaciones, subconsultas y CTE',
    'Acceso a una instancia de PostgreSQL 15 o superior para practicar',
  ],
  modulos: [
    {
      titulo: 'El planificador y la lectura de EXPLAIN',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'PostgreSQL en 100 segundos (vídeo en inglés)', youtube: 'n2Fluyr3lbc', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: cómo leer un plan de ejecución',
          apunte: {
            archivo: 'lectura-explain-analyze.pdf',
            titulo: 'Cómo leer un plan de ejecución',
            resumen:
              'El planificador estima el coste de cada alternativa a partir de las estadísticas de las tablas y elige la ' +
              'más barata. Optimizar consiste en entender por qué eligió ese plan y qué información le faltaba.',
            secciones: [
              {
                titulo: 'EXPLAIN frente a EXPLAIN ANALYZE',
                parrafos: [
                  'EXPLAIN muestra el plan estimado sin ejecutar la consulta. EXPLAIN (ANALYZE, BUFFERS) la ejecuta y añade ' +
                  'tiempos reales, filas reales y páginas leídas de caché (shared hit) o de disco (read). Envuelve en ' +
                  'BEGIN ... ROLLBACK cualquier ANALYZE sobre sentencias que modifican datos.',
                ],
              },
              {
                titulo: 'Qué mirar primero',
                vinetas: [
                  'Diferencia grande entre rows estimadas y reales: estadísticas desactualizadas o correlación entre columnas.',
                  'Seq Scan sobre tablas grandes con filtros selectivos: falta un índice o no es utilizable.',
                  'Nested Loop con muchas iteraciones (loops) sobre el lado interno: considera Hash Join o un índice.',
                  'Sort o Hash con «external merge» o «Batches» > 1: work_mem insuficiente para esa operación.',
                  'Rows Removed by Filter elevado: el índice no cubre la condición completa.',
                ],
              },
              {
                titulo: 'Métodos de unión',
                vinetas: [
                  'Nested Loop: ideal con un lado pequeño y un índice en el otro.',
                  'Hash Join: uniones por igualdad entre conjuntos grandes sin orden previo.',
                  'Merge Join: ambos lados ya ordenados por la clave de unión.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'chuleta-diagnostico-postgresql.pdf',
              titulo: 'Chuleta de diagnóstico PostgreSQL',
              secciones: [
                {
                  titulo: 'Consultas de diagnóstico',
                  vinetas: [
                    'Consultas más costosas: pg_stat_statements ordenado por total_exec_time.',
                    'Índices sin uso: pg_stat_user_indexes con idx_scan = 0.',
                    'Tablas con muchas tuplas muertas: pg_stat_user_tables (n_dead_tup, last_autovacuum).',
                    'Bloqueos en curso: pg_locks unido a pg_stat_activity y pg_blocking_pids(pid).',
                    'Conexiones por estado: pg_stat_activity agrupado por state.',
                  ],
                },
                {
                  titulo: 'Parámetros que conviene conocer',
                  vinetas: [
                    'work_mem: memoria por operación de ordenación o hash.',
                    'random_page_cost: bájalo (1.1) en almacenamiento SSD.',
                    'default_statistics_target y ALTER TABLE ... SET STATISTICS para columnas sesgadas.',
                    'statement_timeout y lock_timeout para acotar consultas y esperas.',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: planificador y EXPLAIN',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'El plan estima 10 filas pero ANALYZE muestra 250 000. ¿Cuál es la primera hipótesis?',
              opciones: ['Falta memoria RAM en el servidor', 'Estadísticas desactualizadas o columnas correlacionadas', 'La red es lenta', 'El índice es demasiado grande'],
              correcta: 'B',
            },
            {
              enunciado: '¿Cómo ejecutas EXPLAIN ANALYZE sobre un UPDATE sin modificar datos?',
              opciones: ['Con EXPLAIN (COSTS OFF)', 'Dentro de BEGIN ... ROLLBACK', 'No es posible', 'Con SET enable_seqscan = off'],
              correcta: 'B',
            },
            {
              enunciado: 'Un Sort muestra «external merge Disk». ¿Qué parámetro revisarías?',
              opciones: ['work_mem', 'max_connections', 'shared_preload_libraries', 'listen_addresses'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Estrategias de indexación',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Siete paradigmas de bases de datos (vídeo en inglés)', youtube: 'W2Z7fbCLSTw', minutos: 10 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: B-tree, GIN, BRIN, parciales y de expresión',
          apunte: {
            archivo: 'estrategias-indexacion-postgresql.pdf',
            titulo: 'Estrategias de indexación en PostgreSQL',
            secciones: [
              {
                titulo: 'Elegir el tipo de índice',
                vinetas: [
                  'B-tree: igualdad, rangos y ORDER BY. Es el predeterminado y cubre la mayoría de casos.',
                  'GIN: arrays, JSONB y búsqueda de texto completo (tsvector).',
                  'GiST / SP-GiST: rangos, geometría y vecinos más cercanos.',
                  'BRIN: tablas enormes con orden natural (series temporales); ocupa muy poco.',
                ],
              },
              {
                titulo: 'Índices compuestos: el orden importa',
                parrafos: [
                  'Para WHERE estado = $1 AND creado_en > $2 ORDER BY creado_en, el índice (estado, creado_en) sirve a la vez ' +
                  'para filtrar y ordenar. Coloca primero las columnas de igualdad y después las de rango u orden. Un índice ' +
                  '(a, b) puede usarse para consultas sobre a sola, pero no para consultas solo sobre b.',
                ],
              },
              {
                titulo: 'Parciales, de expresión y de cobertura',
                vinetas: [
                  'Parcial: CREATE INDEX ... WHERE eliminado_en IS NULL indexa solo las filas vigentes.',
                  'De expresión: CREATE INDEX ... (lower(correo)) para búsquedas sin distinguir mayúsculas.',
                  'De cobertura: INCLUDE (titulo) permite Index Only Scan sin visitar la tabla.',
                  'Crea en producción con CREATE INDEX CONCURRENTLY para no bloquear escrituras.',
                ],
              },
              {
                titulo: 'El coste de indexar',
                parrafos: [
                  'Cada índice ralentiza INSERT y UPDATE, ocupa espacio y compite por la caché. Revisa periódicamente los ' +
                  'índices sin uso y los duplicados antes de añadir uno nuevo.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: indexación',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Consulta: WHERE id_curso = $1 ORDER BY creado_en DESC LIMIT 20. ¿Qué índice es el más adecuado?',
              opciones: ['(creado_en)', '(id_curso, creado_en)', '(creado_en, id_curso)', 'GIN (id_curso)'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué índice conviene para filtrar documentos JSONB con el operador @>?',
              opciones: ['BRIN', 'Hash', 'GIN', 'B-tree sobre la columna completa'],
              correcta: 'C',
            },
            {
              enunciado: '¿Cómo creas un índice en producción sin bloquear las escrituras?',
              opciones: ['CREATE INDEX CONCURRENTLY', 'CREATE UNLOGGED INDEX', 'VACUUM FULL antes de crearlo', 'Desactivando autovacuum'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'MVCC, aislamiento y bloqueos',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Sistemas de bases de datos: curso de Cornell (clase magistral en inglés)', youtube: '4cWkVbC2bNE', minutos: 60 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: concurrencia sin sorpresas',
          apunte: {
            archivo: 'mvcc-aislamiento-bloqueos.pdf',
            titulo: 'MVCC, aislamiento y bloqueos',
            secciones: [
              {
                titulo: 'MVCC en una página',
                parrafos: [
                  'Cada UPDATE crea una nueva versión de la fila; cada transacción ve una instantánea coherente según xmin y ' +
                  'xmax. Por eso los lectores no bloquean a los escritores ni al revés. El precio son las tuplas muertas, que ' +
                  'VACUUM recupera y que, si se acumulan, inflan tablas e índices.',
                ],
              },
              {
                titulo: 'Niveles de aislamiento',
                vinetas: [
                  'READ COMMITTED (predeterminado): cada sentencia ve lo confirmado al empezar esa sentencia.',
                  'REPEATABLE READ: toda la transacción ve la misma instantánea; puede fallar con error de serialización.',
                  'SERIALIZABLE: garantiza un resultado equivalente a ejecución en serie (SSI); reintenta ante 40001.',
                ],
              },
              {
                titulo: 'Bloqueos explícitos útiles',
                vinetas: [
                  'SELECT ... FOR UPDATE: reserva filas que vas a modificar (por ejemplo, un cupo).',
                  'FOR UPDATE SKIP LOCKED: colas de trabajo donde cada proceso toma filas distintas.',
                  'pg_advisory_xact_lock(clave): exclusión mutua por una clave de negocio.',
                  'Ordena siempre los bloqueos de la misma forma para evitar interbloqueos.',
                ],
              },
              {
                titulo: 'Patrón de reintento',
                parrafos: [
                  'Las transacciones REPEATABLE READ y SERIALIZABLE deben reintentarse completas ante los códigos 40001 ' +
                  '(serialization_failure) y 40P01 (deadlock_detected), con un número máximo de intentos y espera exponencial.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: MVCC y concurrencia',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'En MVCC, ¿por qué un SELECT no bloquea a un UPDATE concurrente?',
              opciones: ['Porque PostgreSQL desactiva los bloqueos', 'Porque cada transacción lee una versión coherente de las filas', 'Porque los SELECT se ejecutan en otra base', 'Porque el UPDATE espera siempre'],
              correcta: 'B',
            },
            {
              enunciado: 'Varios procesos toman tareas de una tabla cola sin pisarse. ¿Qué cláusula usas?',
              opciones: ['FOR SHARE', 'NOWAIT', 'FOR UPDATE SKIP LOCKED', 'LOCK TABLE ... IN ACCESS EXCLUSIVE MODE'],
              correcta: 'C',
            },
            {
              enunciado: '¿Qué debes hacer ante el error 40001 en una transacción SERIALIZABLE?',
              opciones: ['Reintentar la transacción completa', 'Ignorarlo, los datos ya se guardaron', 'Cambiar a READ UNCOMMITTED', 'Reiniciar el servidor'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Operación en Supabase: RLS, pooling y mantenimiento',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Caché con Redis en 100 segundos (vídeo en inglés)', youtube: 'G1rOthIU-uo', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: seguridad y rendimiento en Supabase',
          apunte: {
            archivo: 'supabase-rls-pooling-mantenimiento.pdf',
            titulo: 'Supabase: RLS, pooling y mantenimiento',
            secciones: [
              {
                titulo: 'Row Level Security bien diseñada',
                vinetas: [
                  'Activa RLS en toda tabla expuesta por la API de datos y escribe políticas por operación.',
                  'Envuelve auth.uid() en (select auth.uid()) para que se evalúe una vez por consulta y no por fila.',
                  'Indexa las columnas usadas en las políticas (id_usuario, id_organizacion).',
                  'Si el backend usa su propio rol con privilegios mínimos, documenta qué tablas no pasan por RLS.',
                ],
              },
              {
                titulo: 'Pooling de conexiones',
                parrafos: [
                  'Cada conexión de PostgreSQL es un proceso. Para servidores sin estado o funciones serverless usa el pooler ' +
                  'en modo transacción; en ese modo no hay sentencias preparadas persistentes ni variables de sesión, así que ' +
                  'configura el valor por transacción con SET LOCAL o set_config(..., true).',
                ],
              },
              {
                titulo: 'Mantenimiento y caché',
                vinetas: [
                  'Vigila n_dead_tup y ajusta autovacuum_vacuum_scale_factor en tablas muy actualizadas.',
                  'ANALYZE tras cargas masivas para que el planificador tenga estadísticas frescas.',
                  'Cachea lecturas costosas y poco cambiantes (Redis o vistas materializadas con REFRESH CONCURRENTLY).',
                  'Respaldo verificado antes de cada migración: un respaldo que no se ha restaurado no es un respaldo.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación final: operación en Supabase',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Por qué se recomienda escribir (select auth.uid()) dentro de una política RLS?',
              opciones: ['Para que se evalúe una sola vez por consulta', 'Porque auth.uid() no existe', 'Para desactivar RLS', 'Para que funcione en SQLite'],
              correcta: 'A',
            },
            {
              enunciado: 'Con el pooler en modo transacción, ¿cómo fijas un valor de configuración para una operación?',
              opciones: ['SET a nivel de sesión al conectar', 'SET LOCAL dentro de la transacción', 'ALTER SYSTEM', 'No es posible'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué conviene hacer justo después de una carga masiva de datos?',
              opciones: ['DROP de los índices', 'Desactivar autovacuum', 'Ejecutar ANALYZE', 'Reiniciar el pooler'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
  ],
};
