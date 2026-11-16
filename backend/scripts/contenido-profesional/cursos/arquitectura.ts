import type { Curso } from '../tipos.js';

export const arquitectura: Curso = {
  clave: 'arquitectura',
  titulo: 'Arquitectura Hexagonal y Clean Code en Node.js y TypeScript',
  subtitulo: 'Diseña servicios backend testeables y mantenibles con puertos, adaptadores y un dominio libre de frameworks.',
  descripcion:
    'Curso avanzado para desarrolladores backend que ya construyen APIs con Node.js y quieren dar el salto a una arquitectura ' +
    'sostenible. Partimos de los principios de Clean Code y SOLID, modelamos un dominio rico con TypeScript estricto y lo ' +
    'aislamos de Express, PostgreSQL y servicios externos mediante puertos y adaptadores. Cada módulo termina con una ' +
    'evaluación práctica y apuntes descargables con ejemplos de código revisados.',
  nivel: 'AVANZADO',
  categoria: 'Programación',
  autor: 'elianguaman145@gmail.com',
  nombreAutor: 'Elián Guamán',
  publicadoHaceDias: 96,
  objetivos: [
    'Aplicar Clean Code y SOLID para escribir funciones y módulos con una sola razón de cambio',
    'Separar dominio, aplicación e infraestructura con puertos y adaptadores',
    'Modelar entidades, objetos de valor y errores de dominio con TypeScript estricto',
    'Probar casos de uso sin base de datos ni servidor HTTP mediante dobles de prueba',
    'Conectar adaptadores de Express y PostgreSQL sin filtrar detalles al núcleo',
  ],
  requisitos: [
    'Experiencia construyendo APIs REST con Node.js y Express',
    'TypeScript intermedio: genéricos, uniones discriminadas e interfaces',
    'Nociones de SQL y de pruebas automatizadas',
  ],
  modulos: [
    {
      titulo: 'Clean Code y principios SOLID aplicados',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Clean Code según Robert C. Martin (vídeo en inglés)', youtube: '7EmboKQH8lM', minutos: 108 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: nombres, funciones y SOLID en TypeScript',
          apunte: {
            archivo: 'clean-code-solid-typescript.pdf',
            titulo: 'Clean Code y SOLID en TypeScript',
            resumen:
              'El código se lee muchas más veces de las que se escribe. Este apunte resume las reglas que aplicaremos durante ' +
              'todo el curso y las ilustra con ejemplos de un servicio de inscripciones.',
            secciones: [
              {
                titulo: '1. Nombres que revelan intención',
                parrafos: [
                  'Un nombre debe responder por qué existe, qué hace y cómo se usa. Evita abreviaturas y prefijos de tipo: ' +
                  'calcularProgreso(inscripcion) comunica más que calc(i). Usa el vocabulario del negocio (inscripción, ' +
                  'lección, docente) y no el de la infraestructura (row, payload, dto) dentro del dominio.',
                ],
              },
              {
                titulo: '2. Funciones pequeñas con un solo nivel de abstracción',
                vinetas: [
                  'Una función hace una cosa; si puedes extraer otra con un nombre significativo, hace más de una.',
                  'No mezcles reglas de negocio con E/S: primero obtienes los datos, luego decides, al final persistes.',
                  'Prefiere dos o tres parámetros; si necesitas más, agrúpalos en un objeto con nombre.',
                  'Lanza errores de dominio tipados (CursoNoPublicado) en lugar de devolver null o códigos mágicos.',
                ],
              },
              {
                titulo: '3. SOLID en un backend Node.js',
                vinetas: [
                  'S: un caso de uso por clase o función exportada (InscribirEstudiante, PublicarCurso).',
                  'O: añade comportamiento con nuevas implementaciones de un puerto, no con if por proveedor.',
                  'L: cualquier implementación de RepositorioCursos debe respetar el mismo contrato y los mismos errores.',
                  'I: interfaces pequeñas orientadas al cliente (LectorCursos frente a EscritorCursos).',
                  'D: el dominio depende de abstracciones; la composición concreta ocurre en el arranque (composition root).',
                ],
              },
              {
                titulo: '4. Lista de revisión antes de abrir un pull request',
                vinetas: [
                  '¿Puedo describir cada función en una frase sin usar la palabra «y»?',
                  '¿Las pruebas fallan por una sola razón y su nombre describe el comportamiento?',
                  '¿Hay comentarios que explican el qué en lugar del porqué? Conviértelos en nombres.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'guia-rapida-refactorizacion.pdf',
              titulo: 'Guía rápida de refactorización',
              secciones: [
                {
                  titulo: 'Olores de código y su refactorización',
                  vinetas: [
                    'Función larga -> Extraer función; Reemplazar variable temporal por consulta.',
                    'Lista larga de parámetros -> Introducir objeto de parámetros.',
                    'Condicional por tipo -> Reemplazar condicional por polimorfismo o mapa de estrategias.',
                    'Clase de datos anémica -> Mover comportamiento a la entidad que posee los datos.',
                    'Cirugía de escopeta -> Mover funciones al módulo que cambia por la misma razón.',
                    'Envidia de características -> Mover el método a la clase cuyos datos usa.',
                  ],
                },
                {
                  titulo: 'Reglas de seguridad al refactorizar',
                  vinetas: [
                    'Refactoriza solo con pruebas en verde y en pasos pequeños que compilen.',
                    'No mezcles refactorización y cambio de comportamiento en el mismo commit.',
                    'Usa el compilador como red: activa strict, noImplicitReturns y noUnusedLocals.',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: Clean Code y SOLID',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Un servicio decide si un estudiante puede inscribirse y además envía el correo de bienvenida. ¿Qué principio se viola con más claridad?',
              opciones: ['Responsabilidad única (S)', 'Sustitución de Liskov (L)', 'Segregación de interfaces (I)', 'Ninguno, es una buena práctica'],
              correcta: 'A',
            },
            {
              enunciado: '¿Dónde debe ocurrir la composición de las implementaciones concretas según la inversión de dependencias?',
              opciones: ['Dentro de cada entidad de dominio', 'En el composition root, al arrancar la aplicación', 'En los controladores HTTP, al recibir cada petición', 'En las migraciones de la base de datos'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué refactorización corresponde a una función con siete parámetros relacionados?',
              opciones: ['Extraer superclase', 'Renombrar variable', 'Introducir objeto de parámetros', 'Inlining de la función'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Puertos y adaptadores: el núcleo hexagonal',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Patrones de diseño que sostienen la arquitectura (vídeo en inglés)', youtube: 'tv-_1er1mWI', minutos: 11 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: anatomía de una arquitectura hexagonal',
          apunte: {
            archivo: 'arquitectura-hexagonal-puertos-adaptadores.pdf',
            titulo: 'Anatomía de una arquitectura hexagonal',
            resumen:
              'Alistair Cockburn propuso la arquitectura hexagonal para que una aplicación pueda ser conducida igual por ' +
              'usuarios, pruebas o procesos por lotes, y desarrollada y probada aislada de sus dispositivos y bases de datos.',
            secciones: [
              {
                titulo: 'Las tres capas y la regla de dependencia',
                vinetas: [
                  'Dominio: entidades, objetos de valor, servicios de dominio y errores. No importa nada externo.',
                  'Aplicación: casos de uso que orquestan el dominio y declaran los puertos que necesitan.',
                  'Infraestructura: adaptadores que implementan los puertos (PostgreSQL, SMTP, HTTP, colas).',
                  'Las dependencias de código apuntan siempre hacia dentro; los datos pueden fluir en ambos sentidos.',
                ],
              },
              {
                titulo: 'Puertos primarios y secundarios',
                parrafos: [
                  'Un puerto primario (driving) es la API que la aplicación ofrece: por ejemplo, la interfaz InscribirEstudiante ' +
                  'con un método ejecutar(comando). Un puerto secundario (driven) es lo que la aplicación necesita del mundo: ' +
                  'RepositorioInscripciones, Notificador o Reloj. Los adaptadores primarios (un controlador Express, un CLI, una ' +
                  'prueba) llaman a los puertos primarios; los adaptadores secundarios implementan los puertos secundarios.',
                ],
              },
              {
                titulo: 'Estructura de carpetas recomendada',
                vinetas: [
                  'src/inscripciones/dominio/ – Inscripcion.ts, Progreso.ts, errores.ts',
                  'src/inscripciones/aplicacion/ – inscribir-estudiante.ts, puertos.ts',
                  'src/inscripciones/infraestructura/ – inscripciones.pg.ts, inscripciones.http.ts',
                  'src/arranque/ – composición de dependencias y servidor HTTP',
                ],
              },
              {
                titulo: 'Errores frecuentes',
                vinetas: [
                  'Entidades que extienden modelos de un ORM: acoplan el dominio al esquema.',
                  'Casos de uso que reciben req y res de Express: impiden reutilizarlos desde una cola o una prueba.',
                  'Puertos genéricos tipo Repository<T> con veinte métodos: viola la segregación de interfaces.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: puertos y adaptadores',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Un controlador Express que traduce la petición HTTP a un comando y llama al caso de uso es un…',
              opciones: ['Puerto secundario', 'Adaptador primario', 'Objeto de valor', 'Agregado de dominio'],
              correcta: 'B',
            },
            {
              enunciado: '¿Hacia dónde apuntan las dependencias de código en la arquitectura hexagonal?',
              opciones: ['Hacia la base de datos', 'Hacia el framework HTTP', 'Hacia el dominio, en el centro', 'En ambos sentidos según convenga'],
              correcta: 'C',
            },
            {
              enunciado: '¿Cuál de estos es un puerto secundario típico de un caso de uso de inscripción?',
              opciones: ['RepositorioInscripciones', 'El router de Express', 'El componente Angular de catálogo', 'El esquema OpenAPI'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Modelado de dominio con TypeScript estricto',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'TypeScript en 100 segundos (vídeo en inglés)', youtube: 'zQnBQ4tB3ZA', minutos: 2 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: entidades, objetos de valor y uniones discriminadas',
          apunte: {
            archivo: 'modelado-dominio-typescript.pdf',
            titulo: 'Modelado de dominio con TypeScript estricto',
            secciones: [
              {
                titulo: 'Objetos de valor inmutables',
                parrafos: [
                  'Un objeto de valor se define por sus atributos y no tiene identidad: Correo, Porcentaje, Dinero. Valídalo una ' +
                  'sola vez en su constructor estático (Correo.crear(texto)) y hazlo inmutable con readonly. A partir de ahí, el ' +
                  'resto del código puede confiar en que un Correo siempre es válido.',
                ],
              },
              {
                titulo: 'Tipos marcados (branded types)',
                parrafos: [
                  'type IdCurso = number & { readonly __marca: "IdCurso" } impide pasar un IdPersona donde se espera un IdCurso, ' +
                  'aunque ambos sean números. El coste en tiempo de ejecución es cero.',
                ],
              },
              {
                titulo: 'Estados con uniones discriminadas',
                vinetas: [
                  'type Curso = Borrador | EnRevision | Publicado, cada uno con su campo estado literal.',
                  'Las transiciones válidas son funciones: publicar(enRevision, revisor): Publicado.',
                  'El compilador obliga a manejar todos los casos con un switch exhaustivo y never.',
                ],
              },
              {
                titulo: 'Resultados explícitos frente a excepciones',
                parrafos: [
                  'Para fallos esperados del negocio, un tipo Resultado<T, E> hace visible el error en la firma. Reserva las ' +
                  'excepciones para lo verdaderamente excepcional (la base de datos no responde). Elige un estilo por módulo ' +
                  'y sé consistente.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: modelado de dominio',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué distingue a un objeto de valor de una entidad?',
              opciones: ['Se guarda en otra tabla', 'Se define por sus atributos y no tiene identidad propia', 'Siempre es mutable', 'Solo existe en el frontend'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué aporta un switch exhaustivo con una rama default que asigna a never?',
              opciones: ['Mejor rendimiento en tiempo de ejecución', 'Que el compilador avise si se añade un estado sin tratarlo', 'Serialización automática a JSON', 'Validación de entradas HTTP'],
              correcta: 'B',
            },
            {
              enunciado: '¿Cuál es el coste en tiempo de ejecución de un tipo marcado (branded type)?',
              opciones: ['Una clase envolvente por valor', 'Una validación en cada acceso', 'Ninguno: solo existe en el sistema de tipos', 'Un proxy de JavaScript'],
              correcta: 'C',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Adaptadores HTTP, persistencia y pruebas',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'APIs REST con Node.js y Express desde cero (vídeo en inglés)', youtube: '-MTSQjw5DrM', minutos: 12 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: adaptadores de Express y PostgreSQL',
          apunte: {
            archivo: 'adaptadores-express-postgresql.pdf',
            titulo: 'Adaptadores de Express y PostgreSQL',
            secciones: [
              {
                titulo: 'Adaptador HTTP delgado',
                vinetas: [
                  'Valida la entrada con un esquema (zod) y tradúcela a un comando del caso de uso.',
                  'Llama al puerto primario y traduce el resultado o el error de dominio a un código HTTP.',
                  'Nunca contiene reglas de negocio: si un if habla del negocio, pertenece al dominio.',
                ],
              },
              {
                titulo: 'Repositorio SQL parametrizado',
                parrafos: [
                  'El adaptador de PostgreSQL implementa RepositorioInscripciones con consultas parametrizadas ($1, $2). ' +
                  'Mapea filas a entidades en un único lugar y expone operaciones del negocio (guardar, buscarVigente), no ' +
                  'operaciones genéricas. Las transacciones las abre el caso de uso a través de un puerto UnidadDeTrabajo.',
                ],
              },
              {
                titulo: 'Pirámide de pruebas para la arquitectura hexagonal',
                vinetas: [
                  'Unitarias del dominio: sin dobles, rápidas y numerosas.',
                  'Casos de uso con adaptadores en memoria: verifican la orquestación.',
                  'Integración de adaptadores contra una base _test real: verifican SQL y mapeos.',
                  'Pocas pruebas de extremo a extremo por el adaptador HTTP para los flujos críticos.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'plantilla-caso-de-uso.pdf',
              titulo: 'Plantilla de caso de uso y prueba',
              secciones: [
                {
                  titulo: 'Plantilla de caso de uso',
                  vinetas: [
                    'Entrada: comando inmutable con los datos ya validados.',
                    'Dependencias: solo puertos declarados en aplicacion/puertos.ts.',
                    'Pasos: cargar agregados, invocar comportamiento del dominio, persistir, publicar eventos.',
                    'Salida: DTO de respuesta o error de dominio tipado.',
                  ],
                },
                {
                  titulo: 'Plantilla de prueba (Arrange · Act · Assert)',
                  vinetas: [
                    'Arrange: repositorio en memoria con un curso publicado y un estudiante.',
                    'Act: ejecutar InscribirEstudiante con el comando.',
                    'Assert: la inscripción existe, el progreso es 0 % y se notificó una sola vez.',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación final: adaptadores y pruebas',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué responsabilidad NO corresponde al adaptador HTTP?',
              opciones: ['Validar el formato de la entrada', 'Traducir errores de dominio a códigos HTTP', 'Decidir si un curso puede publicarse', 'Llamar al caso de uso'],
              correcta: 'C',
            },
            {
              enunciado: '¿Contra qué base deben ejecutarse las pruebas de integración del repositorio SQL?',
              opciones: ['Contra producción, para tener datos reales', 'Contra una base dedicada a pruebas', 'Contra la base de desarrollo compartida', 'No hace falta base: basta un mock'],
              correcta: 'B',
            },
            {
              enunciado: '¿Por qué conviene usar consultas parametrizadas en el adaptador de PostgreSQL?',
              opciones: ['Previenen la inyección SQL y permiten reutilizar planes', 'Hacen innecesarios los índices', 'Eliminan la necesidad de transacciones', 'Solo por estilo'],
              correcta: 'A',
            },
          ],
        },
      ],
    },
  ],
};
