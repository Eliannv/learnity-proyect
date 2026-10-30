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

/** D3 · Un administrador retiró el rol docente: la persona sigue siendo estudiante y puede volver a solicitarlo. */
export function correoRolDocenteRevocado(datos: { para: string; nombres: string; motivo: string; enlace: string }): Correo {
  const { para, nombres, motivo, enlace } = datos;
  return {
    para,
    asunto: 'Tu rol de docente en Learnity',
    texto: [
      `Hola, ${nombres}:`,
      '',
      'El equipo de Learnity retiró tu rol de docente. Este es el motivo:',
      '',
      motivo,
      '',
      'Sigues teniendo tu cuenta de estudiante. Tus cursos publicados siguen visibles, pero ya no puedes editarlos.',
      `Si quieres, puedes enviar una nueva solicitud desde tu perfil: ${enlace}`,
    ].join('\n'),
    html: marco(
      'Retiramos tu rol de docente',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo('El equipo de Learnity retiró tu rol de docente. Este es el motivo:') +
        cita(motivo) +
        parrafo('Sigues teniendo tu cuenta de estudiante. Tus cursos publicados siguen visibles, pero ya no puedes editarlos.') +
        boton('Ir a mi perfil', enlace),
    ),
  };
}

/** Alta por un administrador (D1): enlace de un solo uso para crear la contraseña. */
export function correoInvitacion(datos: { para: string; nombres: string; enlace: string; horas: number; roles: string }): Correo {
  const { para, nombres, enlace, horas, roles } = datos;
  return {
    para,
    asunto: 'Te invitamos a Learnity',
    texto: [
      `Hola, ${nombres}:`,
      '',
      `El equipo de Learnity creó tu cuenta con este correo (${roles}).`,
      `Para entrar, crea tu contraseña con este enlace. Funciona una sola vez y vence en ${horas} horas:`,
      enlace,
      '',
      'Si vence, usa "¿Olvidaste tu contraseña?" en la página de inicio de sesión con este mismo correo.',
    ].join('\n'),
    html: marco(
      'Te invitamos a Learnity',
      parrafo(`Hola, ${escapar(nombres)}:`) +
        parrafo(`El equipo de Learnity creó tu cuenta con este correo (${escapar(roles)}). Para entrar, crea tu contraseña.`) +
        boton('Crear mi contraseña', enlace) +
        `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">El enlace funciona una sola vez y vence en ${horas} horas. ` +
        'Si vence, usa «¿Olvidaste tu contraseña?» en la página de inicio de sesión con este mismo correo.</p>',
    ),
  };
}
