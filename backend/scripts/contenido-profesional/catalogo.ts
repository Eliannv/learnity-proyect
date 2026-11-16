/**
 * Catálogo profesional de Learnity: cursos, docentes, categorías y la actividad cruzada
 * (inscripciones, reseñas y debates) entre las cuentas autoras.
 * Se transforma en SQL con: npm run contenido:generar
 */
import { angular } from './cursos/angular.js';
import { arquitectura } from './cursos/arquitectura.js';
import { devops } from './cursos/devops.js';
import { postgres } from './cursos/postgres.js';
import { seguridad } from './cursos/seguridad.js';
import { ux } from './cursos/ux.js';
import type { Actividad, Categoria, Curso, Docente } from './tipos.js';

const ELIAN = 'elianguaman145@gmail.com';
const KEVIN = 'kevin.valarezo.1848@gmail.com';
const BETTY = 'bettyguaman75@gmail.com';
const JORGE = 'jvalarezo854@gmail.com';
const ANA = 'ana.torres@learnity.com';

/** Cuentas que deben existir antes de ejecutar el script; no se crean ni se modifican sus datos personales. */
export const CUENTAS = [ELIAN, KEVIN, BETTY, JORGE, ANA];

/** Revisora de los cursos publicados (administradora). */
export const REVISORA = ANA;

export const DOCENTES: Docente[] = [
  {
    correo: ELIAN,
    especialidad: 'Arquitectura de Software y Sistemas Distribuidos',
    motivo: 'Diseño y mantengo servicios backend en Node.js y TypeScript y quiero enseñar arquitectura limpia con casos reales.',
  },
  {
    correo: KEVIN,
    especialidad: 'DevOps, Cloud y Seguridad Informática',
    motivo: 'Trabajo en automatización de despliegues y pruebas de seguridad; quiero formar desarrolladores que entreguen software seguro.',
  },
  {
    correo: BETTY,
    especialidad: 'Diseño de Interfaces UX/UI y Accesibilidad Web',
    motivo: 'Diseño productos digitales con design systems y criterios WCAG, y quiero compartir un método replicable con equipos de producto.',
  },
  {
    correo: ANA,
    especialidad: 'Ingeniería Web y Bases de Datos',
    motivo: 'Administro bases PostgreSQL en producción y quiero publicar cursos de optimización y buenas prácticas de ingeniería web.',
  },
];

export const CATEGORIAS: Categoria[] = [
  { nombre: 'Programación', descripcion: 'Lenguajes, desarrollo web y lógica de programación.', icono: 'code' },
  { nombre: 'Diseño', descripcion: 'Diseño gráfico, UX y herramientas de diseño.', icono: 'pen-tool' },
  { nombre: 'Ciberseguridad', descripcion: 'Seguridad de aplicaciones, pruebas de penetración y defensa.', icono: 'shield-check' },
  { nombre: 'Bases de Datos', descripcion: 'Modelado, SQL, optimización y operación de bases de datos.', icono: 'database' },
  { nombre: 'DevOps y Cloud', descripcion: 'Contenedores, orquestación, CI/CD e infraestructura en la nube.', icono: 'cpu' },
];

export const CURSOS: Curso[] = [arquitectura, seguridad, postgres, angular, ux, devops];

export const ACTIVIDAD: Actividad[] = [
  // ---------------------------------------------------------------- Arquitectura hexagonal (Elián)
  {
    curso: 'arquitectura', estudiante: KEVIN, inscritoHaceDias: 90, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 71,
      comentario:
        'Excelente equilibrio entre teoría y práctica. La separación entre puertos primarios y secundarios por fin me quedó ' +
        'clara, y la plantilla de caso de uso la estoy aplicando en un servicio de pagos. El módulo de pruebas con ' +
        'adaptadores en memoria redujo nuestro tiempo de CI a la mitad.',
    },
    hilo: [
      {
        autor: JORGE, haceDias: 69,
        comentario:
          '¿Cómo manejan las transacciones que abarcan dos repositorios? ¿Abren la transacción en el caso de uso o en el adaptador?',
      },
      {
        autor: ELIAN, haceDias: 68,
        comentario:
          'Buena pregunta. La abre el caso de uso a través de un puerto UnidadDeTrabajo; el adaptador de PostgreSQL la ' +
          'implementa con BEGIN/COMMIT y entrega el mismo cliente a ambos repositorios. Así el dominio no sabe nada de SQL.',
      },
      {
        autor: KEVIN, haceDias: 67,
        comentario: 'Lo implementamos así y además añadimos reintentos ante 40001 en el adaptador. Funciona muy bien.',
      },
    ],
  },
  {
    curso: 'arquitectura', estudiante: JORGE, inscritoHaceDias: 85, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 52,
      comentario:
        'Muy buen curso para quien ya programa APIs y siente que el código se le va de las manos. Los apuntes en PDF son ' +
        'concisos y las evaluaciones obligan a pensar en casos reales, no a memorizar definiciones.',
    },
  },
  {
    curso: 'arquitectura', estudiante: ANA, inscritoHaceDias: 80, lecciones: 'todas',
    resena: {
      estrellas: 4, haceDias: 40,
      comentario:
        'Contenido sólido y bien estructurado. Echo en falta un ejemplo de eventos de dominio con una cola real, pero la ' +
        'parte de modelado con uniones discriminadas es de lo mejor que he visto en español.',
    },
    hilo: [
      {
        autor: ELIAN, haceDias: 38,
        comentario:
          'Gracias, Ana. Estoy preparando una lección adicional con eventos de dominio y el patrón outbox sobre PostgreSQL; ' +
          'la publicaré en el módulo 4.',
      },
    ],
  },
  { curso: 'arquitectura', estudiante: BETTY, inscritoHaceDias: 30, lecciones: 8 },

  // ---------------------------------------------------------------- Seguridad ofensiva y OWASP (Kevin)
  {
    curso: 'seguridad', estudiante: ELIAN, inscritoHaceDias: 84, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 63,
      comentario:
        'Imprescindible para cualquier desarrollador web. Ver la inyección SQL ciega por tiempo en el laboratorio cambia la ' +
        'forma en que escribes consultas. La plantilla de informe de vulnerabilidad es muy profesional.',
    },
    hilo: [
      {
        autor: BETTY, haceDias: 60,
        comentario: '¿Recomiendan alguna herramienta para empezar a auditar sin conocimientos previos de pentesting?',
      },
      {
        autor: KEVIN, haceDias: 59,
        comentario:
          'Para empezar, OWASP ZAP en modo de escaneo pasivo sobre tu propio entorno local y la guía de pruebas de OWASP (WSTG). ' +
          'Siempre en aplicaciones propias o con autorización por escrito.',
      },
    ],
  },
  {
    curso: 'seguridad', estudiante: JORGE, inscritoHaceDias: 75, lecciones: 'todas',
    resena: {
      estrellas: 4, haceDias: 33,
      comentario:
        'Muy completo. El módulo de XSS y CSRF con ejemplos en Angular es muy útil. Me gustaría ver más sobre SSRF y ' +
        'seguridad en APIs GraphQL en una próxima edición.',
    },
  },
  {
    curso: 'seguridad', estudiante: ANA, inscritoHaceDias: 50, lecciones: 9,
    resena: {
      estrellas: 5, haceDias: 21,
      comentario:
        'La sección de defensa en profundidad para PostgreSQL (mínimos privilegios y RLS) está muy bien explicada. ' +
        'Lo recomendaré a todo el equipo de backend.',
    },
  },
  { curso: 'seguridad', estudiante: BETTY, inscritoHaceDias: 26, lecciones: 6 },

  // ---------------------------------------------------------------- PostgreSQL (Ana)
  {
    curso: 'postgres', estudiante: JORGE, inscritoHaceDias: 98, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 76,
      comentario:
        'El mejor curso de PostgreSQL que he tomado. Aprendí a leer EXPLAIN ANALYZE de verdad: encontré una consulta con ' +
        'estimaciones erróneas por columnas correlacionadas y la resolví con estadísticas extendidas. Pasó de 4 s a 40 ms.',
    },
    hilo: [
      {
        autor: ANA, haceDias: 75,
        comentario:
          '¡Qué buen resultado, Jorge! Para quien lo lea: CREATE STATISTICS ... (dependencies) ON col_a, col_b FROM tabla y ' +
          'luego ANALYZE. Es una de las optimizaciones más infravaloradas.',
      },
      {
        autor: ELIAN, haceDias: 73,
        comentario: '¿Eso también ayuda cuando las columnas están en un índice compuesto o solo en el filtro?',
      },
      {
        autor: ANA, haceDias: 72,
        comentario:
          'Ayuda al planificador a estimar cuántas filas cumplen ambas condiciones, así que influye en la elección del plan ' +
          'tanto si hay índice compuesto como si no. El índice decide cómo se leen; las estadísticas, cuántas se esperan.',
      },
    ],
  },
  {
    curso: 'postgres', estudiante: ELIAN, inscritoHaceDias: 90, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 47,
      comentario:
        'El módulo de MVCC y niveles de aislamiento es oro. El patrón de reintento ante 40001 y 40P01 lo hemos llevado tal ' +
        'cual a producción. Muy recomendable para backend.',
    },
  },
  {
    curso: 'postgres', estudiante: KEVIN, inscritoHaceDias: 60, lecciones: 7,
    resena: {
      estrellas: 4, haceDias: 28,
      comentario:
        'Muy buen contenido sobre índices y Supabase. Sugeriría añadir un laboratorio sobre particionamiento de tablas de ' +
        'registros, que en DevOps es un caso muy común.',
    },
  },
  { curso: 'postgres', estudiante: BETTY, inscritoHaceDias: 20, lecciones: 4 },

  // ---------------------------------------------------------------- Angular avanzado (Elián)
  {
    curso: 'angular', estudiante: BETTY, inscritoHaceDias: 70, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 44,
      comentario:
        'Como diseñadora que maqueta, entender OnPush y signals me ayudó a hablar el mismo idioma que el equipo frontend. ' +
        'La explicación de linkedSignal con filtros y paginación es clarísima.',
    },
    hilo: [
      {
        autor: ELIAN, haceDias: 43,
        comentario:
          'Gracias, Betty. Si combinas esto con los tokens de tu curso de design systems, tienes componentes reactivos y ' +
          'temáticos sin código duplicado.',
      },
    ],
  },
  {
    curso: 'angular', estudiante: JORGE, inscritoHaceDias: 64, lecciones: 9,
    resena: {
      estrellas: 4, haceDias: 24,
      comentario:
        'Muy actualizado: zoneless, resource y Vitest. La migración desde NgModules con la checklist fue directa. Solo ' +
        'añadiría más ejemplos de SSR e hidratación incremental.',
    },
  },
  {
    curso: 'angular', estudiante: ANA, inscritoHaceDias: 58, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 15,
      comentario:
        'Curso avanzado de verdad. La regla «si puedes expresarlo con computed, no uses effect» resume muchas horas de ' +
        'depuración. Los apuntes son una referencia que vuelvo a consultar.',
    },
  },
  { curso: 'angular', estudiante: KEVIN, inscritoHaceDias: 18, lecciones: 5 },

  // ---------------------------------------------------------------- Design systems (Betty)
  {
    curso: 'ux', estudiante: ELIAN, inscritoHaceDias: 76, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 55,
      comentario:
        'Por fin entiendo la diferencia entre tokens primitivos y semánticos. Implementamos el modo oscuro cambiando solo ' +
        'la capa semántica, como se explica en el módulo 2. Muy práctico para desarrolladores.',
    },
    hilo: [
      {
        autor: BETTY, haceDias: 54,
        comentario:
          'Me alegra mucho, Elián. Un consejo extra: valida el contraste de cada pareja de tokens en ambos modos; es ' +
          'donde más fallos de accesibilidad aparecen.',
      },
      {
        autor: ANA, haceDias: 50,
        comentario: '¿Qué herramienta usan para validar los contrastes de forma automática en Figma?',
      },
      {
        autor: BETTY, haceDias: 49,
        comentario:
          'En Figma, un plugin de contraste sobre las variables; en código, pruebas con axe-core en el pipeline. ' +
          'Lo ideal es tener ambas comprobaciones.',
      },
    ],
  },
  {
    curso: 'ux', estudiante: ANA, inscritoHaceDias: 66, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 36,
      comentario:
        'El módulo de WCAG 2.2 es muy claro y aplicable desde el primer día. La ficha de componente con anatomía, estados ' +
        'y accesibilidad la adoptamos como plantilla del equipo.',
    },
  },
  {
    curso: 'ux', estudiante: JORGE, inscritoHaceDias: 42, lecciones: 6,
    resena: {
      estrellas: 4, haceDias: 12,
      comentario:
        'Muy buena introducción a la gobernanza de un design system. Me habría gustado un caso completo de migración de ' +
        'una aplicación existente al sistema.',
    },
  },
  { curso: 'ux', estudiante: KEVIN, inscritoHaceDias: 14, lecciones: 3 },

  // ---------------------------------------------------------------- DevOps (Kevin)
  {
    curso: 'devops', estudiante: ELIAN, inscritoHaceDias: 62, lecciones: 'todas',
    resena: {
      estrellas: 4, haceDias: 31,
      comentario:
        'Muy buen recorrido de Git a Kubernetes. El Dockerfile de referencia y la sección de cadena de suministro con OIDC y ' +
        'acciones fijadas por SHA son muy valiosos. Añadiría un ejemplo con Helm.',
    },
    hilo: [
      {
        autor: KEVIN, haceDias: 30,
        comentario:
          'Gracias por la sugerencia. Helm y Kustomize entrarán en una lección nueva del módulo 3 con un despliegue canary ' +
          'completo.',
      },
    ],
  },
  {
    curso: 'devops', estudiante: JORGE, inscritoHaceDias: 55, lecciones: 'todas',
    resena: {
      estrellas: 5, haceDias: 18,
      comentario:
        'Excelente. Pasé de desplegar a mano por SSH a un pipeline con pruebas, escaneo de imagen y despliegue a staging. ' +
        'Las preguntas de evaluación son exigentes y muy realistas.',
    },
  },
  {
    curso: 'devops', estudiante: ANA, inscritoHaceDias: 40, lecciones: 8,
    resena: {
      estrellas: 5, haceDias: 9,
      comentario:
        'Claro, directo y con buenas prácticas de seguridad en cada etapa. La parte de sondas readiness y liveness evitó ' +
        'un error que teníamos en producción.',
    },
  },
  {
    curso: 'devops', estudiante: BETTY, inscritoHaceDias: 22, lecciones: 6,
    resena: {
      estrellas: 4, haceDias: 5,
      comentario:
        'Aunque vengo del diseño, el curso se entiende muy bien. Ahora comprendo qué ocurre entre que apruebo un diseño y ' +
        'llega a producción.',
    },
  },
];
