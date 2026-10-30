import type { Correo } from '../../shared/correo/correo.js';
import { boton, cita, escapar, marco, parrafo } from '../../shared/correo/plantilla.js';

// Plantillas del módulo Revisión: el docente conoce la decisión sobre su curso.

export function correoCursoAprobado(datos: { para: string; nombres: string; titulo: string; enlace: string }): Correo {
  const { para, nombres, titulo, enlace } = datos;
  return {
    para,
    asunto: `Tu curso «${titulo}» ya está publicado`,
    texto: [
      `Hola, ${nombres}:`,
      '',
      `Aprobamos tu curso «${titulo}» y ya aparece en el catálogo de Learnity.`,
      `Míralo como lo verán tus estudiantes: ${enlace}`,
      '',
      'Puedes seguir ampliándolo desde tu panel sin volver a revisión.',
    ].join('\n'),
    html: marco(
      'Tu curso ya está publicado',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo(`Aprobamos <strong>${escapar(titulo)}</strong> y ya aparece en el catálogo.`) +
        boton('Ver el curso publicado', enlace) +
        '<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">Puedes seguir ampliándolo desde tu panel sin volver a revisión.</p>',
    ),
  };
}

export function correoCursoRechazado(datos: {
  para: string; nombres: string; titulo: string; motivo: string; enlace: string;
}): Correo {
  const { para, nombres, titulo, motivo, enlace } = datos;
  return {
    para,
    asunto: `Tu curso «${titulo}» necesita cambios`,
    texto: [
      `Hola, ${nombres}:`,
      '',
      `Revisamos tu curso «${titulo}» y necesita algunos cambios antes de publicarse:`,
      '',
      motivo,
      '',
      `Corrígelo y vuelve a enviarlo a revisión: ${enlace}`,
    ].join('\n'),
    html: marco(
      'Tu curso necesita cambios',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo(`Revisamos <strong>${escapar(titulo)}</strong> y necesita algunos cambios antes de publicarse:`) +
        cita(motivo) +
        boton('Corregir el curso', enlace),
    ),
  };
}

/** Un administrador suspendió el curso publicado: sale del catálogo y sus estudiantes no pueden abrirlo. */
export function correoCursoSuspendido(datos: {
  para: string; nombres: string; titulo: string; motivo: string; enlace: string;
}): Correo {
  const { para, nombres, titulo, motivo, enlace } = datos;
  return {
    para,
    asunto: `Suspendimos tu curso «${titulo}»`,
    texto: [
      `Hola, ${nombres}:`,
      '',
      `Suspendimos tu curso «${titulo}». Este es el motivo:`,
      '',
      motivo,
      '',
      'Mientras esté suspendido no aparece en el catálogo y tus estudiantes no pueden abrirlo, aunque conservan su progreso.',
      'Tampoco puedes editarlo. Si quieres aclarar algo, responde a este correo.',
      `Tus cursos: ${enlace}`,
    ].join('\n'),
    html: marco(
      'Suspendimos tu curso',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo(`Suspendimos <strong>${escapar(titulo)}</strong>. Este es el motivo:`) +
        cita(motivo) +
        parrafo('Mientras esté suspendido no aparece en el catálogo y tus estudiantes no pueden abrirlo, aunque conservan su progreso. ' +
          'Tampoco puedes editarlo. Si quieres aclarar algo, responde a este correo.') +
        boton('Ver mis cursos', enlace),
    ),
  };
}

/** El curso suspendido vuelve a estar publicado. */
export function correoCursoReactivado(datos: { para: string; nombres: string; titulo: string; enlace: string }): Correo {
  const { para, nombres, titulo, enlace } = datos;
  return {
    para,
    asunto: `Tu curso «${titulo}» vuelve a estar publicado`,
    texto: [
      `Hola, ${nombres}:`,
      '',
      `Reactivamos tu curso «${titulo}». Vuelve a aparecer en el catálogo y tus estudiantes pueden continuar donde lo dejaron.`,
      `Míralo aquí: ${enlace}`,
    ].join('\n'),
    html: marco(
      'Tu curso vuelve a estar publicado',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo(`Reactivamos <strong>${escapar(titulo)}</strong>. Vuelve al catálogo y tus estudiantes pueden continuar donde lo dejaron.`) +
        boton('Ver el curso', enlace),
    ),
  };
}
