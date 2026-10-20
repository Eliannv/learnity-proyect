/**
 * DATOS DE DEMOSTRACIÓN (Sprint 1).
 * Son los mismos textos del prototipo en Pencil. Las pantallas los leen desde aquí;
 * en los siguientes sprints cada lista se reemplaza por su llamada a la API.
 */

import type { Tono } from '../shared/ui/tipos-ui';

// Reexportados para los importadores que aún leen estos tipos desde aquí.
export { ICONO_CATEGORIA } from '../shared/ui/tipos-ui';
export type { Tono };

export type EstadoCurso = 'BORRADOR' | 'EN_REVISION' | 'PUBLICADO' | 'RECHAZADO' | 'ARCHIVADO';
export type TipoLeccion = 'VIDEO' | 'DOCUMENTO' | 'PRESENTACION' | 'EVALUACION';

export interface CursoCatalogo {
  id: string;
  titulo: string;
  categoria: string;
  docente: string;
  modulos: number;
  lecciones: number;
  minutos: number;
  nivel: 'Principiante' | 'Intermedio' | 'Avanzado';
  tono: Tono;
  nuevo?: boolean;
}

export const CATEGORIAS = ['Programación', 'Diseño', 'Idiomas', 'Negocios', 'Ofimática', 'Marketing'];

export const CURSOS: CursoCatalogo[] = [
  { id: 'introduccion-a-python', titulo: 'Introducción a Python', categoria: 'Programación', docente: 'Carlos Mendoza', modulos: 4, lecciones: 11, minutos: 18, nivel: 'Principiante', tono: 1 },
  { id: 'diseno-ux-desde-cero', titulo: 'Diseño UX desde cero', categoria: 'Diseño', docente: 'Laura Pérez', modulos: 4, lecciones: 16, minutos: 16, nivel: 'Principiante', tono: 2 },
  { id: 'ingles-conversacional', titulo: 'Inglés conversacional', categoria: 'Idiomas', docente: 'Jorge Molina', modulos: 5, lecciones: 22, minutos: 20, nivel: 'Intermedio', tono: 3 },
  { id: 'excel-para-principiantes', titulo: 'Excel para principiantes', categoria: 'Ofimática', docente: 'Andrés Vera', modulos: 3, lecciones: 12, minutos: 15, nivel: 'Principiante', tono: 1 },
  { id: 'javascript-para-la-web', titulo: 'JavaScript para la web', categoria: 'Programación', docente: 'Carlos Mendoza', modulos: 5, lecciones: 18, minutos: 17, nivel: 'Intermedio', tono: 1, nuevo: true },
  { id: 'fotografia-con-el-celular', titulo: 'Fotografía con el celular', categoria: 'Diseño', docente: 'Laura Pérez', modulos: 3, lecciones: 10, minutos: 14, nivel: 'Principiante', tono: 2, nuevo: true },
  { id: 'emprende-tu-negocio', titulo: 'Emprende tu negocio en línea', categoria: 'Negocios', docente: 'Sofía Vargas', modulos: 4, lecciones: 14, minutos: 19, nivel: 'Principiante', tono: 3, nuevo: true },
  { id: 'marketing-redes-sociales', titulo: 'Marketing en redes sociales', categoria: 'Marketing', docente: 'Diego Castro', modulos: 4, lecciones: 13, minutos: 16, nivel: 'Intermedio', tono: 1, nuevo: true },
  { id: 'git-y-github', titulo: 'Git y GitHub desde cero', categoria: 'Programación', docente: 'Paola Ríos', modulos: 4, lecciones: 12, minutos: 15, nivel: 'Intermedio', tono: 2 },
  { id: 'sql-para-analisis', titulo: 'SQL para análisis de datos', categoria: 'Programación', docente: 'Miguel Sánchez', modulos: 5, lecciones: 17, minutos: 20, nivel: 'Avanzado', tono: 3 },
  { id: 'comunicacion-efectiva', titulo: 'Comunicación efectiva en el trabajo', categoria: 'Negocios', docente: 'Sofía Vargas', modulos: 3, lecciones: 9, minutos: 12, nivel: 'Intermedio', tono: 2 },
  { id: 'ingles-para-entrevistas', titulo: 'Inglés para entrevistas de trabajo', categoria: 'Idiomas', docente: 'Jorge Molina', modulos: 4, lecciones: 14, minutos: 17, nivel: 'Avanzado', tono: 1 },
];

export const DESTACADOS = CURSOS.slice(0, 4);
export const RECIENTES = CURSOS.filter((c) => c.nuevo);

export const INDICADORES_PUBLICOS = [
  { valor: '34', etiqueta: 'Cursos disponibles' },
  { valor: '1 208', etiqueta: 'Estudiantes inscritos' },
  { valor: '36', etiqueta: 'Docentes' },
  { valor: '6', etiqueta: 'Categorías' },
];

// ---------------------------------------------------------------- detalle y lecciones
export interface LeccionTemario {
  id: string;
  titulo: string;
  tipo: TipoLeccion;
  detalle: string; // "4 min", "PDF", "5 preguntas"
  completada?: boolean;
}

export interface ModuloTemario {
  numero: number;
  titulo: string;
  resumen: string; // "3 lecciones · 8 min"
  lecciones: LeccionTemario[];
  completado?: boolean;
}

export const TEMARIO_PYTHON: ModuloTemario[] = [
  {
    numero: 1,
    titulo: 'Primeros pasos',
    resumen: '3 lecciones · 8 min',
    completado: true,
    lecciones: [
      { id: 'instalar-python', titulo: 'Instalar Python', tipo: 'VIDEO', detalle: '4 min', completada: true },
      { id: 'guia-instalacion', titulo: 'Guía de instalación', tipo: 'DOCUMENTO', detalle: 'PDF', completada: true },
      { id: 'evaluacion-modulo-1', titulo: 'Evaluación del módulo', tipo: 'EVALUACION', detalle: '5 preguntas', completada: true },
    ],
  },
  {
    numero: 2,
    titulo: 'Variables y datos',
    resumen: '3 lecciones · 5 min',
    lecciones: [
      { id: 'tipos-de-datos', titulo: 'Tipos de datos', tipo: 'VIDEO', detalle: '4 min' },
      { id: 'presentacion-del-tema', titulo: 'Presentación del tema', tipo: 'PRESENTACION', detalle: '2 min' },
      { id: 'evaluacion-modulo-2', titulo: 'Evaluación del módulo', tipo: 'EVALUACION', detalle: '5 preguntas' },
    ],
  },
  {
    numero: 3,
    titulo: 'Condiciones y ciclos',
    resumen: '2 lecciones · 6 min',
    lecciones: [
      { id: 'condicionales', titulo: 'Condicionales if', tipo: 'VIDEO', detalle: '4 min' },
      { id: 'evaluacion-modulo-3', titulo: 'Evaluación del módulo', tipo: 'EVALUACION', detalle: '5 preguntas' },
    ],
  },
  {
    numero: 4,
    titulo: 'Funciones',
    resumen: '3 lecciones · 8 min',
    lecciones: [
      { id: 'definir-funciones', titulo: 'Definir funciones', tipo: 'VIDEO', detalle: '5 min' },
      { id: 'parametros', titulo: 'Parámetros y retorno', tipo: 'VIDEO', detalle: '3 min' },
      { id: 'evaluacion-modulo-4', titulo: 'Evaluación del módulo', tipo: 'EVALUACION', detalle: '5 preguntas' },
    ],
  },
];

export const DETALLE_PYTHON = {
  descripcion:
    'Aprende los fundamentos de Python: variables, condiciones, ciclos y funciones. Cada lección incluye un video corto y material de apoyo.',
  docenteBio: 'Ingeniero de software con 8 años de experiencia. Enseña programación desde 2018. Tiene 3 cursos publicados.',
  incluye: [
    { icono: 'circle-play', texto: 'Videos cortos y livianos' },
    { icono: 'list-checks', texto: '5 a 10 preguntas por evaluación' },
    { icono: 'rotate-ccw', texto: 'Puedes reintentar sin límite' },
    { icono: 'lock', texto: 'Solo tú ves tu avance' },
  ],
};

// ---------------------------------------------------------------- estudiante
/** Última lección abierta del curso (inscripcion.id_ultima_leccion). */
export interface UltimaLeccion {
  titulo: string;
  tipo: TipoLeccion;
  detalle: string; // "Video · 4 min"
  ruta: string;
}

export interface CursoInscrito {
  curso: CursoCatalogo;
  progreso: number;
  nota: string;
  completado?: boolean;
  inscrito: string; // ISO, para ordenar
  ultimaLeccion: UltimaLeccion;
}

/** Ordenados del más reciente al más antiguo según la última actividad. */
export const MIS_CURSOS: CursoInscrito[] = [
  {
    curso: CURSOS[0]!,
    progreso: 45,
    nota: '45% completado · módulo 2 de 4',
    inscrito: '2026-02-08',
    ultimaLeccion: { titulo: 'Tipos de datos', tipo: 'VIDEO', detalle: 'Video · 4 min', ruta: '/aprender/introduccion-a-python/tipos-de-datos' },
  },
  {
    curso: CURSOS[3]!,
    progreso: 20,
    nota: '20% completado · módulo 1 de 3',
    inscrito: '2026-03-10',
    ultimaLeccion: { titulo: 'Fórmulas y referencias', tipo: 'DOCUMENTO', detalle: 'Documento · PDF', ruta: '/aprender/excel-para-principiantes/guia-instalacion' },
  },
  {
    curso: CURSOS[7]!,
    progreso: 0,
    nota: 'Sin empezar',
    inscrito: '2026-09-28',
    ultimaLeccion: { titulo: 'Bienvenida al curso', tipo: 'VIDEO', detalle: 'Video · 2 min', ruta: '/aprender/marketing-redes-sociales/instalar-python' },
  },
  {
    curso: CURSOS[2]!,
    progreso: 100,
    nota: '100% · completado el 04 mar 2026',
    completado: true,
    inscrito: '2026-01-20',
    ultimaLeccion: { titulo: 'Repaso final', tipo: 'EVALUACION', detalle: 'Evaluación · 5 preguntas', ruta: '/aprender/ingles-conversacional/tipos-de-datos' },
  },
];

/** Resumen de avance en los cursos activos (progreso_leccion + intento_evaluacion). */
export const RESUMEN_AVANCE = {
  leccionesVistas: 7,
  leccionesTotales: 36,
  evaluacionesAprobadas: 2,
  faltanEnCursoPrincipal: 6,
};

/** Intentos de evaluación del estudiante (intento_evaluacion). */
export const MIS_EVALUACIONES = [
  { curso: 'Introducción a Python', cursoId: 'introduccion-a-python', evaluacion: 'Evaluación · Módulo 1', evaluacionId: 'evaluacion-modulo-1', nota: 80, aprobada: true, fecha: '12 mar 2026' },
  { curso: 'Excel para principiantes', cursoId: 'excel-para-principiantes', evaluacion: 'Evaluación · Módulo 1', evaluacionId: 'evaluacion-modulo-2', nota: 40, aprobada: false, fecha: '15 mar 2026' },
  { curso: 'Inglés conversacional', cursoId: 'ingles-conversacional', evaluacion: 'Repaso final', evaluacionId: 'evaluacion-modulo-2', nota: 90, aprobada: true, fecha: '04 mar 2026' },
];

export const RECURSOS_LECCION = [
  { nombre: 'tipos-de-datos-python.pdf', detalle: 'PDF · 1,2 MB', tipo: 'pdf' as const },
  { nombre: 'clase-tipos-de-datos.pptx', detalle: 'PowerPoint · 3,8 MB', tipo: 'ppt' as const },
];

export const PREGUNTA_EVALUACION = {
  enunciado: '¿Qué función muestra un mensaje en pantalla en Python?',
  opciones: [
    { letra: 'A', texto: 'input()' },
    { letra: 'B', texto: 'print()' },
    { letra: 'C', texto: 'len()' },
    { letra: 'D', texto: 'type()' },
  ],
  correcta: 'B',
};

// ---------------------------------------------------------------- docente
export interface CursoDocente {
  id: string;
  titulo: string;
  estado: EstadoCurso;
  detalle: string;
  modulos: number;
  minutos: number;
}

export const CURSOS_DOCENTE: CursoDocente[] = [
  {
    id: 'javascript-para-la-web',
    titulo: 'JavaScript para la web',
    estado: 'BORRADOR',
    detalle: 'Actualizado 18 mar 2026 · 0 inscritos · Falta 1 módulo con lecciones para enviarlo a revisión.',
    modulos: 2,
    minutos: 9,
  },
  {
    id: 'diseno-ux-desde-cero',
    titulo: 'Diseño UX desde cero',
    estado: 'EN_REVISION',
    detalle: 'Actualizado 14 mar 2026 · 0 inscritos · En manos de Administración. No puedes editarlo mientras esté en revisión.',
    modulos: 4,
    minutos: 16,
  },
  {
    id: 'introduccion-a-python',
    titulo: 'Introducción a Python',
    estado: 'PUBLICADO',
    detalle: 'Actualizado 02 mar 2026 · 128 inscritos',
    modulos: 4,
    minutos: 18,
  },
  {
    id: 'fotografia-con-el-celular',
    titulo: 'Fotografía con el celular',
    estado: 'RECHAZADO',
    detalle:
      'Actualizado 20 feb 2026 · Rechazado por Administración: el módulo 2 no tiene evaluación. Corrige y vuelve a enviarlo.',
    modulos: 3,
    minutos: 14,
  },
];

export const INDICADORES_DOCENTE = [
  { etiqueta: 'PUBLICADOS', valor: '1', nota: 'Visible en el catálogo', icono: 'book-open' },
  { etiqueta: 'EN REVISIÓN', valor: '1', nota: 'Desde el 14 mar', icono: 'shield-check' },
  { etiqueta: 'POR TERMINAR', valor: '2', nota: '1 borrador · 1 rechazado', icono: 'pen-tool' },
  { etiqueta: 'INSCRIPCIONES', valor: '128', nota: '+12 este mes', icono: 'users' },
];

export interface LeccionEditor {
  titulo: string;
  tipo: TipoLeccion;
  detalle: string;
}

export const MODULOS_EDITOR: { titulo: string; minutos: string; lecciones: LeccionEditor[]; sinEvaluacion?: boolean }[] = [
  {
    titulo: 'Módulo 1 · Primeros pasos',
    minutos: '5 min',
    lecciones: [
      { titulo: 'Instalar Python', tipo: 'VIDEO', detalle: 'Video · 2:40 · 4,1 MB' },
      { titulo: 'Guía de instalación', tipo: 'DOCUMENTO', detalle: 'Documento · PDF' },
      { titulo: 'Evaluación del módulo', tipo: 'EVALUACION', detalle: 'Evaluación · 8 preguntas' },
    ],
  },
  {
    titulo: 'Módulo 2 · Variables y datos',
    minutos: '4 min',
    sinEvaluacion: true,
    lecciones: [
      { titulo: 'Tipos de datos', tipo: 'VIDEO', detalle: 'Video · 2:10 · 3,4 MB' },
      { titulo: 'Presentación del tema', tipo: 'PRESENTACION', detalle: 'Presentación · PowerPoint' },
    ],
  },
];

export const VERIFICACION_ENVIO = [
  { ok: false, texto: 'Falta la portada del curso (imagen 16:9, máx. 1 MB).' },
  { ok: false, texto: 'Todos los videos cumplen: MP4, máx. 5 MB y 480p.' },
  { ok: true, texto: 'Cada módulo tiene al menos una lección.' },
  { ok: false, texto: 'El módulo 2 no tiene evaluación (5 a 10 preguntas).' },
];

export const PREGUNTAS_EDITOR = [
  '¿Qué función muestra un mensaje en pantalla?',
  '¿Cómo se declara una variable en Python?',
  '¿Qué tipo de dato es "Hola"?',
  '¿Qué operador concatena textos?',
  '¿Qué devuelve type(10)?',
];

export const ESTUDIANTES_CURSO = [
  { iniciales: 'RV', nombre: 'Rosa Vera Chávez', inscrito: '08 feb', progreso: 45, actividad: 'Hoy · Módulo 2', completado: false },
  { iniciales: 'JM', nombre: 'Jorge Molina', inscrito: '21 abr', progreso: 100, actividad: '28 sep · Completado', completado: true },
  { iniciales: 'SV', nombre: 'Sofía Vargas', inscrito: '02 may', progreso: 72, actividad: 'Ayer · Módulo 3', completado: false },
  { iniciales: 'DC', nombre: 'Diego Castro', inscrito: '15 jun', progreso: 20, actividad: '20 sep · Módulo 1', completado: false },
  { iniciales: 'MR', nombre: 'María Ríos', inscrito: '03 jul', progreso: 100, actividad: '25 sep · Completado', completado: true },
];

export const INDICADORES_ESTUDIANTES = [
  { etiqueta: 'INSCRITOS', valor: '128', nota: '+12 este mes' },
  { etiqueta: 'EN CURSO', valor: '87', nota: 'Con avance activo' },
  { etiqueta: 'COMPLETARON', valor: '41', nota: '32 % del total' },
  { etiqueta: 'NOTA PROMEDIO', valor: '82 %', nota: 'En evaluaciones' },
];

// ---------------------------------------------------------------- administración
export const INDICADORES_ADMIN = [
  { etiqueta: 'USUARIOS', valor: '1 248', nota: '+32 esta semana', icono: 'users' },
  { etiqueta: 'DOCENTES', valor: '36', nota: '5 solicitudes pendientes', icono: 'user-check' },
  { etiqueta: 'CURSOS PUBLICADOS', valor: '34', nota: '3 en revisión', icono: 'book-open' },
  { etiqueta: 'INSCRIPCIONES', valor: '4 210', nota: '62 % completan su curso', icono: 'trending-up' },
];

export interface SolicitudDocente {
  iniciales: string;
  nombre: string;
  correo: string;
  especialidad: string;
  cuando: string;
  enviada: string;
  estudianteDesde: string;
  cursosCompletados: number;
  motivacion: string;
}

export const SOLICITUDES: SolicitudDocente[] = [
  {
    iniciales: 'LP',
    nombre: 'Laura Pérez',
    correo: 'laura.perez@correo.com',
    especialidad: 'Diseño gráfico',
    cuando: 'Hoy, 09:14',
    enviada: '30 sep 2026, 09:14',
    estudianteDesde: '03 mar 2026',
    cursosCompletados: 4,
    motivacion:
      'Soy diseñadora gráfica desde hace 6 años y he dictado talleres de Canva e Illustrator en mi comunidad. Quiero publicar un curso de diseño para principiantes con videos cortos y plantillas descargables.',
  },
  {
    iniciales: 'JM',
    nombre: 'Jorge Molina',
    correo: 'jorge.molina@correo.com',
    especialidad: 'Inglés',
    cuando: 'Ayer',
    enviada: '29 sep 2026, 18:40',
    estudianteDesde: '21 abr 2026',
    cursosCompletados: 2,
    motivacion: 'Soy profesor de inglés en un colegio de Machala y quiero compartir clases cortas de conversación para principiantes.',
  },
  {
    iniciales: 'SV',
    nombre: 'Sofía Vargas',
    correo: 'sofia.vargas@correo.com',
    especialidad: 'Marketing digital',
    cuando: '28 sep',
    enviada: '28 sep 2026, 11:05',
    estudianteDesde: '02 may 2026',
    cursosCompletados: 3,
    motivacion: 'Trabajo en marketing para pequeños negocios y quiero enseñar a crear campañas simples en redes sociales.',
  },
  {
    iniciales: 'DC',
    nombre: 'Diego Castro',
    correo: 'diego.castro@correo.com',
    especialidad: 'Fotografía',
    cuando: '27 sep',
    enviada: '27 sep 2026, 16:22',
    estudianteDesde: '15 jun 2026',
    cursosCompletados: 1,
    motivacion: 'Soy fotógrafo independiente y quiero enseñar técnicas básicas de fotografía con el celular.',
  },
  {
    iniciales: 'MR',
    nombre: 'María Ríos',
    correo: 'maria.rios@correo.com',
    especialidad: 'Contabilidad',
    cuando: '25 sep',
    enviada: '25 sep 2026, 08:50',
    estudianteDesde: '03 jul 2026',
    cursosCompletados: 2,
    motivacion: 'Soy contadora y quiero preparar un curso corto de contabilidad básica para emprendedores.',
  },
];

export const CURSOS_EN_REVISION = [
  { id: 'diseno-ux-desde-cero', titulo: 'Diseño UX desde cero', detalle: 'Laura Pérez · 4 módulos · 16 lecciones' },
  { id: 'ingles-conversacional', titulo: 'Inglés conversacional', detalle: 'Jorge Molina · 5 módulos · 22 lecciones' },
  { id: 'excel-para-principiantes', titulo: 'Excel para principiantes', detalle: 'Andrés Vera · 3 módulos · 12 lecciones' },
];

export interface UsuarioAdmin {
  iniciales: string;
  nombre: string;
  correo: string;
  roles: ('Estudiante' | 'Docente' | 'Administrador')[];
  activo: boolean;
  registro: string;
}

export const USUARIOS: UsuarioAdmin[] = [
  { iniciales: 'RV', nombre: 'Rosa Vera Chávez', correo: 'rosa.vera@correo.com', roles: ['Estudiante'], activo: true, registro: '08 feb 2026' },
  { iniciales: 'CM', nombre: 'Carlos Mendoza Ruiz', correo: 'carlos.mendoza@correo.com', roles: ['Estudiante', 'Docente'], activo: true, registro: '12 ene 2026' },
  { iniciales: 'LP', nombre: 'Laura Pérez', correo: 'laura.perez@correo.com', roles: ['Estudiante', 'Docente'], activo: true, registro: '03 mar 2026' },
  { iniciales: 'JM', nombre: 'Jorge Molina', correo: 'jorge.molina@correo.com', roles: ['Estudiante'], activo: true, registro: '21 abr 2026' },
  { iniciales: 'AV', nombre: 'Andrés Vera', correo: 'andres.vera@correo.com', roles: ['Estudiante', 'Docente'], activo: false, registro: '15 feb 2026' },
  { iniciales: 'AT', nombre: 'Ana Torres', correo: 'ana.torres@learnity.com', roles: ['Administrador'], activo: true, registro: '01 ene 2026' },
];

export const CATEGORIAS_ADMIN = [
  { nombre: 'Programación', icono: 'code', cursos: 12, estudiantes: '1 840', activa: true },
  { nombre: 'Diseño', icono: 'pen-tool', cursos: 8, estudiantes: '920', activa: true },
  { nombre: 'Idiomas', icono: 'languages', cursos: 6, estudiantes: '610', activa: true },
  { nombre: 'Negocios', icono: 'briefcase', cursos: 4, estudiantes: '380', activa: true },
  { nombre: 'Marketing', icono: 'megaphone', cursos: 3, estudiantes: '250', activa: true },
  { nombre: 'Ofimática', icono: 'monitor', cursos: 1, estudiantes: '90', activa: false },
];

export const REVISION_UX = {
  titulo: 'Diseño UX desde cero',
  categoria: 'Diseño · Principiante',
  descripcion: 'Aprende a investigar usuarios, crear flujos y prototipar interfaces con ejemplos reales.',
  meta: 'Laura Pérez · enviado el 29 sep 2026 · 4 módulos · 16 lecciones · 58 MB de 150 MB',
  modulos: [
    {
      titulo: 'Módulo 1 · Qué es UX',
      resumen: '3 lecciones',
      lecciones: [
        { titulo: 'Introducción al diseño UX', tipo: 'VIDEO' as TipoLeccion, detalle: 'Video · 2:30 · 4,2 MB · 480p' },
        { titulo: 'Glosario UX', tipo: 'DOCUMENTO' as TipoLeccion, detalle: 'PDF · 1,1 MB' },
        { titulo: 'Evaluación del módulo', tipo: 'EVALUACION' as TipoLeccion, detalle: '6 preguntas' },
      ],
    },
    {
      titulo: 'Módulo 2 · Investigación de usuarios',
      resumen: '2 lecciones',
      lecciones: [
        { titulo: 'Entrevistas efectivas', tipo: 'VIDEO' as TipoLeccion, detalle: 'Video · 2:50 · 4,8 MB · 480p' },
        { titulo: 'Plantilla de entrevista', tipo: 'PRESENTACION' as TipoLeccion, detalle: 'PowerPoint · 3,4 MB' },
      ],
    },
  ],
  verificacion: [
    'Página del curso completa',
    '4 módulos (máximo 10)',
    'Todas las lecciones tienen contenido',
    'Videos MP4 ≤ 5 MB y ≤ 480p',
    'PDF y PowerPoint ≤ 10 MB',
    'Evaluaciones con 5 a 10 preguntas',
    'Espacio usado: 58 de 150 MB',
  ],
};

/** Ícono de Lucide según el tipo de lección. */
export function iconoLeccion(tipo: TipoLeccion): string {
  switch (tipo) {
    case 'VIDEO':
      return 'circle-play';
    case 'DOCUMENTO':
      return 'file-text';
    case 'PRESENTACION':
      return 'presentation';
    default:
      return 'list-checks';
  }
}
