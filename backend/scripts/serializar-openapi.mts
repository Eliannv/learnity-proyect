import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openApi } from '../src/shared/openapi/openapi.js';

const destino = fileURLToPath(new URL('../../docs/api/openapi.yaml', import.meta.url));
const cabecera = [
  '# Contrato de la API de Learnity: generado desde backend/src/shared/openapi/openapi*.ts.',
  '# No se edita a mano. Ejecuta npm run api:serializar en backend/.',
  '# El cuerpo es JSON, que también es YAML 1.2 válido.',
].join('\n');
const documento = `${cabecera}\n${JSON.stringify(openApi, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const guardado = await readFile(destino, 'utf8');
  const json = guardado.split(/\r?\n/).filter((linea) => !linea.startsWith('#')).join('\n');
  assert.deepStrictEqual(JSON.parse(json), openApi);
  process.stdout.write('OpenAPI coincide con el código.\n');
} else {
  await writeFile(destino, documento, 'utf8');
  process.stdout.write('OpenAPI serializado.\n');
}
