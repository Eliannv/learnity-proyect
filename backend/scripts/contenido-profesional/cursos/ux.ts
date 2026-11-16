import type { Curso } from '../tipos.js';

export const ux: Curso = {
  clave: 'ux',
  titulo: 'Diseño de Sistemas UX/UI Escalables con Design Systems',
  subtitulo: 'Crea un design system con tokens, componentes accesibles y gobernanza para que producto y desarrollo hablen el mismo idioma.',
  descripcion:
    'Curso para diseñadores de producto, desarrolladores frontend y analistas UX que necesitan pasar de pantallas sueltas a ' +
    'un sistema coherente. Definimos fundamentos y tokens, construimos componentes con variantes y estados en Figma, ' +
    'aplicamos WCAG 2.2 nivel AA desde el diseño y establecemos un proceso de gobernanza, versionado y documentación que ' +
    'mantenga el sistema vivo cuando el producto crece.',
  nivel: 'INTERMEDIO',
  categoria: 'Diseño',
  autor: 'bettyguaman75@gmail.com',
  nombreAutor: 'Betty Guamán',
  publicadoHaceDias: 81,
  objetivos: [
    'Definir los fundamentos de un design system: principios, color, tipografía, espaciado y movimiento',
    'Estructurar tokens primitivos, semánticos y de componente con variables de Figma',
    'Diseñar componentes con variantes, estados y comportamiento responsive',
    'Aplicar WCAG 2.2 AA: contraste, foco visible, objetivos táctiles y lectores de pantalla',
    'Gobernar el sistema con versionado semántico, contribuciones y documentación',
  ],
  requisitos: [
    'Manejo básico de Figma (frames, auto layout y componentes)',
    'Haber participado en el diseño o desarrollo de una interfaz web o móvil',
  ],
  modulos: [
    {
      titulo: 'Fundamentos de un design system',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Introducción a los design systems, por Figma (vídeo en inglés)', youtube: 't3VW-qa8544', minutos: 40 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: qué es (y qué no es) un design system',
          apunte: {
            archivo: 'fundamentos-design-system.pdf',
            titulo: 'Fundamentos de un design system',
            resumen:
              'Un design system es un producto interno: un conjunto de decisiones documentadas, componentes reutilizables y ' +
              'un proceso para mantenerlos. Una librería de componentes sin principios ni gobernanza es solo un kit de UI.',
            secciones: [
              {
                titulo: 'Las capas del sistema',
                vinetas: [
                  'Principios: criterios para decidir cuando dos opciones parecen válidas (claridad antes que densidad).',
                  'Fundamentos: color, tipografía, espaciado, elevación, iconografía y movimiento.',
                  'Componentes: botones, campos, tarjetas, diálogos; cada uno con anatomía, variantes y estados.',
                  'Patrones: soluciones a problemas recurrentes (formularios, estados vacíos, carga, errores).',
                  'Documentación y gobernanza: cómo usar, cómo contribuir y cómo se versiona.',
                ],
              },
              {
                titulo: 'Inventario de interfaz',
                parrafos: [
                  'Antes de crear nada, captura todas las variantes existentes de cada elemento (cuántos tonos de azul, cuántos ' +
                  'estilos de botón). El inventario cuantifica la deuda de diseño y prioriza qué componentes construir primero.',
                ],
              },
              {
                titulo: 'Métricas de adopción',
                vinetas: [
                  'Porcentaje de pantallas que usan componentes del sistema.',
                  'Número de componentes desconectados (detached) en los archivos de producto.',
                  'Tiempo desde el diseño hasta producción de una nueva funcionalidad.',
                ],
              },
            ],
          },
          recursos: [
            {
              archivo: 'plantilla-inventario-interfaz.pdf',
              titulo: 'Plantilla de inventario de interfaz',
              secciones: [
                {
                  titulo: 'Columnas del inventario',
                  vinetas: [
                    'Elemento (botón, campo de texto, tarjeta, alerta...).',
                    'Pantalla y flujo donde aparece, con captura.',
                    'Variante observada: tamaño, color, radio, tipografía.',
                    '¿Cumple contraste AA? ¿Tiene foco visible?',
                    'Propuesta: consolidar en la variante X del sistema / eliminar.',
                  ],
                },
              ],
            },
          ],
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: fundamentos',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué diferencia a un design system de un simple kit de UI?',
              opciones: ['Tiene más colores', 'Incluye principios, documentación y un proceso de gobernanza', 'Solo funciona en Figma', 'No tiene componentes'],
              correcta: 'B',
            },
            {
              enunciado: '¿Para qué sirve un inventario de interfaz al iniciar un sistema?',
              opciones: ['Para cuantificar inconsistencias y priorizar componentes', 'Para elegir la tipografía de marca', 'Para medir el rendimiento web', 'Para reemplazar las pruebas con usuarios'],
              correcta: 'A',
            },
            {
              enunciado: '¿Cuál es una métrica útil de adopción del sistema?',
              opciones: ['Número de capas en Figma', 'Porcentaje de pantallas construidas con componentes del sistema', 'Peso de las imágenes', 'Cantidad de colores en la paleta'],
              correcta: 'B',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Tokens de diseño y variables',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Tokens y variables de Figma: configuración (vídeo en inglés)', youtube: 'HNJmWKndUA4', minutos: 25 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: tokens primitivos, semánticos y de componente',
          apunte: {
            archivo: 'tokens-diseno-variables.pdf',
            titulo: 'Tokens de diseño y variables',
            secciones: [
              {
                titulo: 'Tres niveles de tokens',
                vinetas: [
                  'Primitivos: la paleta cruda (azul-600 = #3B4FD8, espacio-4 = 16 px). No se usan directamente en componentes.',
                  'Semánticos: la intención (color-fondo-superficie, color-texto-error, espacio-seccion).',
                  'De componente: decisiones locales (boton-primario-fondo) que apuntan a semánticos.',
                ],
              },
              {
                titulo: 'Modos claro y oscuro',
                parrafos: [
                  'Los modos se resuelven en la capa semántica: color-texto-principal apunta a gris-900 en modo claro y a ' +
                  'gris-50 en modo oscuro. Los componentes no cambian; solo cambia el modo activo de la colección.',
                ],
              },
              {
                titulo: 'Del diseño al código',
                vinetas: [
                  'Exporta los tokens a JSON (formato W3C Design Tokens) y transfórmalos a CSS custom properties.',
                  'Nombra igual en Figma y en código para que la conversación sea directa.',
                  'Prohíbe valores en bruto (#hex, px sueltos) en las hojas de estilo de los componentes.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: tokens',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué nivel de token debe cambiar para implementar el modo oscuro?',
              opciones: ['Primitivo', 'Semántico', 'De componente', 'Ninguno, se duplican los componentes'],
              correcta: 'B',
            },
            {
              enunciado: '¿Cuál de estos nombres corresponde a un token semántico?',
              opciones: ['azul-600', 'color-texto-error', '#D92D20', 'radio-8px-boton-v2-final'],
              correcta: 'B',
            },
            {
              enunciado: '¿Por qué evitar valores hexadecimales en bruto en los estilos de componentes?',
              opciones: ['Porque pesan más', 'Porque rompen la trazabilidad y los modos del sistema', 'Porque CSS no los admite', 'Porque Figma no los exporta'],
              correcta: 'B',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Accesibilidad WCAG 2.2 desde el diseño',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Los cuatro principios de WCAG (POUR) en 3 minutos (vídeo en inglés)', youtube: 'KMB_2Htl9dg', minutos: 3 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: criterios AA que todo componente debe cumplir',
          apunte: {
            archivo: 'accesibilidad-wcag-22-componentes.pdf',
            titulo: 'Accesibilidad WCAG 2.2 en componentes',
            secciones: [
              {
                titulo: 'Perceptible',
                vinetas: [
                  'Contraste mínimo 4,5:1 para texto normal y 3:1 para texto grande y componentes de interfaz (1.4.3, 1.4.11).',
                  'No transmitas información solo con color: añade icono o texto al estado de error.',
                  'Texto alternativo en imágenes informativas; alt vacío en las decorativas.',
                ],
              },
              {
                titulo: 'Operable',
                vinetas: [
                  'Todo se puede usar con teclado y el foco es visible y no queda oculto (2.4.7, 2.4.11).',
                  'Objetivos táctiles de al menos 24 × 24 px (2.5.8); recomendamos 44 × 44 px en móvil.',
                  'Las acciones de arrastrar tienen una alternativa con un solo puntero (2.5.7).',
                ],
              },
              {
                titulo: 'Comprensible y robusto',
                vinetas: [
                  'Etiquetas visibles en los campos y errores junto al campo que los causa.',
                  'Autenticación accesible: permite pegar contraseñas y usar gestores (3.3.8).',
                  'Usa elementos nativos (button, a, input) antes que ARIA; si usas ARIA, completa nombre, rol y valor.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación: accesibilidad',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: '¿Qué contraste mínimo exige WCAG AA para texto de tamaño normal?',
              opciones: ['3:1', '4,5:1', '7:1', '2:1'],
              correcta: 'B',
            },
            {
              enunciado: 'Un campo con error solo se marca en rojo. ¿Qué falta?',
              opciones: ['Un borde más grueso', 'Un mensaje de texto o icono que no dependa del color', 'Una animación', 'Nada, el rojo es suficiente'],
              correcta: 'B',
            },
            {
              enunciado: '¿Cuál es el tamaño mínimo de objetivo táctil según WCAG 2.2 (2.5.8)?',
              opciones: ['12 × 12 px', '24 × 24 px', '64 × 64 px', 'No hay mínimo'],
              correcta: 'B',
            },
          ],
        },
      ],
    },
    {
      titulo: 'Componentes, documentación y gobernanza',
      lecciones: [
        { tipo: 'VIDEO', titulo: 'Construye un design system: curso completo (vídeo en inglés)', youtube: 'opTANvl9G1g', minutos: 90 },
        { tipo: 'VIDEO', titulo: 'Tu primer design system en Figma paso a paso (vídeo en inglés)', youtube: '_uva2dQPlV8', minutos: 20 },
        {
          tipo: 'DOCUMENTO',
          titulo: 'Apunte: anatomía de componente y proceso de contribución',
          apunte: {
            archivo: 'componentes-documentacion-gobernanza.pdf',
            titulo: 'Componentes, documentación y gobernanza',
            secciones: [
              {
                titulo: 'Ficha de un componente',
                vinetas: [
                  'Anatomía: partes con nombre (contenedor, etiqueta, icono inicial, icono final).',
                  'Variantes: jerarquía (primario, secundario, terciario) y tamaño.',
                  'Estados: reposo, hover, foco, presionado, deshabilitado, cargando, error.',
                  'Comportamiento: responsive, contenido largo, truncado y localización.',
                  'Accesibilidad: rol, nombre accesible, teclado y anuncios para lectores de pantalla.',
                  'Cuándo usarlo y cuándo no, con ejemplos correctos e incorrectos.',
                ],
              },
              {
                titulo: 'Gobernanza',
                parrafos: [
                  'Define quién decide (equipo central, modelo federado o híbrido) y cómo se contribuye: propuesta, revisión ' +
                  'de diseño y accesibilidad, implementación, documentación y anuncio. Publica versiones con versionado ' +
                  'semántico: los cambios que rompen compatibilidad suben la versión mayor y llevan guía de migración.',
                ],
              },
              {
                titulo: 'Señales de que el sistema está sano',
                vinetas: [
                  'Los equipos de producto proponen componentes en lugar de crearlos por su cuenta.',
                  'Diseño y código comparten nombres y tokens.',
                  'El registro de cambios se lee y las migraciones se completan.',
                ],
              },
            ],
          },
        },
        {
          tipo: 'EVALUACION',
          titulo: 'Evaluación final: componentes y gobernanza',
          aprobacion: 70,
          preguntas: [
            {
              enunciado: 'Un cambio en el componente Botón rompe la API existente. ¿Qué versión publicas según semver?',
              opciones: ['Parche (x.y.Z)', 'Menor (x.Y.z)', 'Mayor (X.y.z)', 'No hace falta versionar'],
              correcta: 'C',
            },
            {
              enunciado: '¿Qué estado de componente se olvida con más frecuencia y es crítico para usuarios de teclado?',
              opciones: ['Hover', 'Foco', 'Presionado', 'Seleccionado'],
              correcta: 'B',
            },
            {
              enunciado: '¿Qué indica que el design system está sano?',
              opciones: ['Cada equipo crea sus propios botones', 'Los equipos proponen componentes y comparten nombres con el código', 'Nadie lee la documentación', 'Hay una versión distinta por proyecto'],
              correcta: 'B',
            },
          ],
        },
      ],
    },
  ],
};
