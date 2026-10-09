import type { Correo } from '../../shared/correo/correo.js';

// Plantillas de los correos del módulo Identidad. Nunca incluyen contraseñas ni datos de sesión.

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function marco(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#1d4ed8">Learnity</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapar(titulo)}</h1>
${cuerpo}
</td></tr></table></td></tr></table></body></html>`;
}

export function correoRecuperacion(datos: { para: string; nombres: string; enlace: string; minutos: number }): Correo {
  const { para, nombres, enlace, minutos } = datos;
  return {
    para,
    asunto: 'Restablece tu contraseña de Learnity',
    texto: [
      `Hola, ${nombres}:`,
      '',
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Learnity.',
      `Abre este enlace para crear una nueva (vence en ${minutos} minutos y solo funciona una vez):`,
      '',
      enlace,
      '',
      'Si no lo pediste, ignora este correo: tu contraseña no cambiará.',
    ].join('\n'),
    html: marco(
      'Restablece tu contraseña',
      `<p style="margin:0 0 12px;line-height:1.5">Hola, ${escapar(nombres)}:</p>
<p style="margin:0 0 20px;line-height:1.5">Recibimos una solicitud para restablecer la contraseña de tu cuenta.
El enlace vence en <strong>${minutos} minutos</strong> y solo funciona una vez.</p>
<p style="margin:0 0 24px"><a href="${escapar(enlace)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Crear nueva contraseña</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">Si no lo pediste, ignora este correo: tu contraseña no cambiará.</p>`,
    ),
  };
}

export function correoContrasenaCambiada(datos: { para: string; nombres: string; enlaceRecuperar: string }): Correo {
  const { para, nombres, enlaceRecuperar } = datos;
  return {
    para,
    asunto: 'Tu contraseña de Learnity cambió',
    texto: [
      `Hola, ${nombres}:`,
      '',
      'La contraseña de tu cuenta de Learnity acaba de cambiar y cerramos tus otras sesiones.',
      `Si no fuiste tú, recupera tu cuenta ahora: ${enlaceRecuperar}`,
    ].join('\n'),
    html: marco(
      'Tu contraseña cambió',
      `<p style="margin:0 0 12px;line-height:1.5">Hola, ${escapar(nombres)}:</p>
<p style="margin:0 0 16px;line-height:1.5">La contraseña de tu cuenta acaba de cambiar y cerramos tus otras sesiones.</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">Si no fuiste tú, <a href="${escapar(enlaceRecuperar)}">recupera tu cuenta ahora</a>.</p>`,
    ),
  };
}
