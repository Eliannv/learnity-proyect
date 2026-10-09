// Autoriza UNA vez la cuenta emisora de Gmail y guarda su refresh token en backend/.env.
//   npm run correo:autorizar
// Requisitos (ver README, sección Correo): GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET de un cliente OAuth
// de tipo "App de escritorio" en Google Cloud, con la Gmail API habilitada.
// El token nunca se imprime: se escribe directamente en .env (que no se sube a Git).
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const ALCANCE = 'https://www.googleapis.com/auth/gmail.send';
const clientId = process.env['GMAIL_CLIENT_ID']?.trim();
const clientSecret = process.env['GMAIL_CLIENT_SECRET']?.trim();

if (!clientId || !clientSecret) {
  console.error('Faltan GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en backend/.env. Revisa la guía del README.');
  process.exit(1);
}

const verificador = randomBytes(48).toString('base64url');
const desafio = createHash('sha256').update(verificador).digest('base64url');
const estado = randomBytes(16).toString('hex');

const codigo = await new Promise<{ code: string; redirect: string }>((resolver, rechazar) => {
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404).end();
      return;
    }
    const redirect = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/oauth2callback`;
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const ok = !error && code && url.searchParams.get('state') === estado;
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ok ? '<h1>Listo. Ya puedes cerrar esta pestaña.</h1>' : '<h1>No se completó la autorización.</h1>');
    servidor.close();
    if (ok) resolver({ code, redirect });
    else rechazar(new Error(error ?? 'respuesta inválida (state no coincide)'));
  });
  servidor.listen(0, '127.0.0.1', () => {
    const redirect = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/oauth2callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: ALCANCE,
      access_type: 'offline',
      prompt: 'consent',
      state: estado,
      code_challenge: desafio,
      code_challenge_method: 'S256',
    }).toString();
    console.log('\n1. Abre este enlace en el navegador e inicia sesión con la cuenta EMISORA (GMAIL_REMITENTE):\n');
    console.log(url.toString());
    console.log('\n2. Acepta el permiso "Enviar correo electrónico en tu nombre". Esperando la respuesta…');
  });
});

const respuesta = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: codigo.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: codigo.redirect,
    grant_type: 'authorization_code',
    code_verifier: verificador,
  }),
});
const datos = (await respuesta.json()) as { refresh_token?: string; scope?: string; error?: string };
if (!respuesta.ok || !datos.refresh_token) {
  console.error(`Google no entregó el refresh token (${datos.error ?? respuesta.status}).`);
  process.exit(1);
}
if (datos.scope?.split(' ').some((s) => s !== ALCANCE)) {
  console.error('La autorización incluye permisos de más; vuelve a intentarlo solo con gmail.send.');
  process.exit(1);
}

const archivo = path.resolve('.env');
const actual = await readFile(archivo, 'utf8');
const linea = `GMAIL_REFRESH_TOKEN=${datos.refresh_token}`;
const nuevo = /^GMAIL_REFRESH_TOKEN=.*$/m.test(actual)
  ? actual.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, linea)
  : `${actual.trimEnd()}\n${linea}\n`;
await writeFile(archivo, nuevo);
console.log('\n✓ Refresh token guardado en backend/.env (GMAIL_REFRESH_TOKEN). No lo compartas ni lo subas a Git.');
console.log('  Siguiente paso: CORREO_TRANSPORTE=gmail y npm run correo:probar -- tu-buzon-de-prueba@gmail.com');
