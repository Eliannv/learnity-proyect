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
