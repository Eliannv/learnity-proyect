import type { Correo } from '../../shared/correo/correo.js';
import { boton, cita, escapar, marco, parrafo } from '../../shared/correo/plantilla.js';

// Plantillas del módulo Usuarios: resultado de una solicitud para ser docente.

export function correoSolicitudAprobada(datos: { para: string; nombres: string; enlace: string }): Correo {
  const { para, nombres, enlace } = datos;
  return {
    para,
    asunto: 'Ya eres docente en Learnity',
    texto: [
      `Hola, ${nombres}:`,
      '',
      'Aprobamos tu solicitud. Ya puedes crear tu primer curso y enviarlo a revisión.',
      `Empieza aquí: ${enlace}`,
      '',
      'Si ya tenías la sesión abierta, vuelve a iniciarla para ver el panel de docente.',
    ].join('\n'),
    html: marco(
      'Ya eres docente',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo('Aprobamos tu solicitud. Ya puedes crear tu primer curso y enviarlo a revisión.') +
        boton('Crear mi primer curso', enlace) +
        '<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">Si ya tenías la sesión abierta, vuelve a iniciarla para ver el panel de docente.</p>',
    ),
  };
}

export function correoSolicitudRechazada(datos: {
  para: string; nombres: string; observacion: string; enlace: string;
}): Correo {
  const { para, nombres, observacion, enlace } = datos;
  return {
    para,
    asunto: 'Tu solicitud para ser docente en Learnity',
    texto: [
      `Hola, ${nombres}:`,
      '',
      'Revisamos tu solicitud para ser docente y por ahora no la aprobamos. Esta es la observación del equipo:',
      '',
      observacion,
      '',
      `Puedes ajustarla y enviar una nueva desde tu perfil: ${enlace}`,
    ].join('\n'),
    html: marco(
      'Revisamos tu solicitud',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo('Por ahora no aprobamos tu solicitud para ser docente. Esta es la observación del equipo:') +
        cita(observacion) +
        parrafo('Puedes ajustarla y enviar una nueva desde tu perfil.') +
        boton('Ir a mi perfil', enlace),
    ),
  };
}
