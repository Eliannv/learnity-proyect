// Envía un correo de prueba con el transporte configurado (CORREO_TRANSPORTE en .env).
//   npm run correo:probar -- buzon.de.prueba@gmail.com
// Con CORREO_TRANSPORTE=gmail confirma que la Gmail API, el OAuth y la cuenta emisora funcionan.
import { env } from '../src/shared/config/env.js';
import { enviarCorreo } from '../src/shared/correo/correo.js';
import { pool } from '../src/shared/database/pool.js';

const para = process.argv[2];
if (!para || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) {
  console.error('Uso: npm run correo:probar -- buzon.de.prueba@gmail.com');
  process.exit(1);
}

try {
  await enviarCorreo({
    para,
    asunto: 'Correo de prueba de Learnity',
    texto: 'Si lees esto, el envío de correos de Learnity funciona.',
    html: '<p>Si lees esto, el envío de correos de <strong>Learnity</strong> funciona.</p>',
  });
  console.log(
    env.CORREO_TRANSPORTE === 'gmail'
      ? `✓ Enviado con la Gmail API desde ${env.GMAIL_REMITENTE} a ${para}. Revisa la bandeja (y Spam).`
      : `✓ Guardado en el buzón local (${env.BUZON_DIR}). Para enviarlo de verdad usa CORREO_TRANSPORTE=gmail.`,
  );
} catch (error) {
  console.error(`✗ No se pudo enviar: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
