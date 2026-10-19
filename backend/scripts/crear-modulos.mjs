// Genera la estructura de un módulo según docs/arquitectura/PLANTILLA_MODULO.md (§1 y §4).
// Uso (desde backend/): node scripts/crear-modulos.mjs <nombre> "<descripción>" "<rutas previstas separadas por ;>" [--puerto <Nombre>]
//   <nombre>   en minúsculas, por dominio y con guiones si hace falta (p. ej. categorias, cursos-temario).
//              Nunca por persona (*-integrante2) ni por integración (*-integracion).
//   --puerto   crea además puertos.ts con un puerto vacío (solo si el módulo define uno, ADR-004).
// Crea backend/src/modules/<nombre>/ y backend/test/<nombre>/. No pisa nada: si el módulo ya existe, se detiene.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argumentos = process.argv.slice(2);
const indicePuerto = argumentos.indexOf('--puerto');
let puerto = null;
if (indicePuerto !== -1) {
  puerto = argumentos[indicePuerto + 1];
  argumentos.splice(indicePuerto, puerto === undefined ? 1 : 2);
  if (!puerto || !/^[A-Z][A-Za-z0-9]*$/.test(puerto)) {
    console.error('--puerto necesita un nombre en PascalCase (p. ej. --puerto VerificadorPdf).');
    process.exit(1);
  }
}

const [nombre, descripcion = '', rutas = ''] = argumentos;
const USO =
  'Uso: node scripts/crear-modulos.mjs <nombre> "<descripción>" "<rutas previstas separadas por ;>" [--puerto <Nombre>]';

if (!nombre) {
  console.error(USO);
  process.exit(1);
}
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(nombre)) {
  console.error(`Nombre inválido "${nombre}": usa minúsculas, dígitos y guiones (p. ej. categorias).`);
  process.exit(1);
}
if (/integrante|integracion/i.test(nombre)) {
  console.error('Los nombres van por dominio, nunca por persona ni por integración (PLANTILLA_MODULO §1).');
  process.exit(1);
}

const aCamel = (texto) => texto.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const m = nombre; // prefijo de los archivos
const ident = aCamel(nombre); // categoriasTemario
const Ident = mayuscula(ident); // CategoriasTemario

const dirModulo = join('src', 'modules', nombre);
const dirPruebas = join('test', nombre);
if (existsSync(dirModulo)) {
  console.error(`El módulo ${nombre} ya existe en ${dirModulo}.`);
  process.exit(1);
}

const listaRutas = rutas
  .split(';')
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => `//   ${r}`)
  .join('\n');

const archivos = {
  'index.ts': `// modules/${nombre}/index.ts — API pública del módulo ${nombre}.
// Otros módulos y app.ts SOLO importan desde aquí. Nada de repositorios, esquemas ni controladores.
export { ${ident}Routes } from './${m}.routes.js';
export type { Servicio${Ident} } from './${m}.service.js';
export { ${ident}Api } from './${m}.service.js';
export type * from './${m}.modelo.js';${
    puerto
      ? `
// Puerto del módulo (ADR-004). app.ts lo registra al crear la app.
export { registrar${puerto} } from './puertos.js';
export type { ${puerto} } from './puertos.js';`
      : ''
  }
`,

  [`${m}.routes.ts`]: `import { Router } from 'express';
// Orden fijo de middlewares (PLANTILLA_MODULO §3):
// limitarPorIp → verificarOrigen/exigirCsrf (solo /auth) → autenticar → autorizar(...) →
// validarParametros → validarConsulta → validarCuerpo → [middlewares propios] → controlador
// import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
// import { ${ident}Controller } from './${m}.controller.js';

// Módulo ${nombre}${descripcion ? ` · ${descripcion}` : ''}
// Rutas previstas:
${listaRutas || '//   (por definir)'}
export const ${ident}Routes = Router();
`,

  [`${m}.controller.ts`]: `// import type { Request, Response } from 'express';
// import { ${ident}Service } from './${m}.service.js';

// Capa HTTP del módulo ${nombre}: lee los datos ya validados, llama al servicio y fija estado y encabezados.
// Sin parse/safeParse, sin reglas de negocio y sin SQL.
export const ${ident}Controller = {};
`,

  [`${m}.service.ts`]: `// import { ${ident}Repository } from './${m}.repository.js';
// import { AppError } from '../../shared/http/app-error.js';
// import { enTransaccion } from '../../shared/database/pool.js';

/** Lo que otros módulos pueden usar del módulo ${nombre}. */
export interface Servicio${Ident} {}

// Reglas de negocio, rol Y propiedad, transacciones (enTransaccion, con { actor } si escribe).
// Los efectos externos (disco, correo) van DESPUÉS del COMMIT, nunca con filas bloqueadas.
// Si necesita datos de otro módulo, importa su index.ts, nunca su repositorio.
export const ${ident}Service: Servicio${Ident} = {};

/** Objeto público que exporta index.ts: solo lo que implementa Servicio${Ident}. */
export const ${ident}Api: Servicio${Ident} = ${ident}Service;
`,

  [`${m}.repository.ts`]: `// import { consultar } from '../../shared/database/pool.js';
// import type { Ejecutor } from '../../shared/database/pool.js';

// Todo el SQL del módulo ${nombre}, con parámetros $1, $2… Los fragmentos dinámicos (orden, FOR UPDATE)
// solo salen de un Record o de una lista cerrada del código. Mapea las filas a ${m}.modelo.ts.
export const ${ident}Repository = {};
`,

  [`${m}.esquemas.ts`]: `// import { z } from 'zod';

// Esquemas zod de parámetros, consulta y cuerpo (z.strictObject si el contrato no admite claves extra),
// con mensajes en español, y los tipos inferidos con z.infer.
export {};
`,

  [`${m}.modelo.ts`]: `// Tipos públicos del dominio ${nombre}: los que puede ver otro módulo. Sin lógica.
// Nunca incluyas archivo.ruta ni otros datos privados.
export {};
`,
};

if (puerto) {
  archivos['puertos.ts'] = `// Puerto del módulo ${nombre} (ADR-004): el módulo define la interfaz y otro módulo la implementa
// y la registra al crear la app. Así no hay import circular entre los dos.
export interface ${puerto} {}

let implementacion: ${puerto} | undefined;

export function registrar${puerto}(nueva: ${puerto}): void {
  implementacion = nueva;
}

export function ${aCamel(puerto.charAt(0).toLowerCase() + puerto.slice(1))}(): ${puerto} {
  if (!implementacion) {
    throw new Error('El puerto ${puerto} no se registró al crear la app.');
  }
  return implementacion;
}
`;
}

mkdirSync(dirModulo, { recursive: true });
for (const [archivo, contenido] of Object.entries(archivos)) {
  writeFileSync(join(dirModulo, archivo), contenido, 'utf8');
}
mkdirSync(dirPruebas, { recursive: true });
writeFileSync(join(dirPruebas, '.gitkeep'), '', 'utf8');

console.log(`Módulo ${nombre} creado en ${dirModulo} (pruebas en ${dirPruebas}).`);
console.log('Siguiente paso: montar ' + ident + 'Routes en app.ts (dueño: be-a) desde modules/' + nombre + '/index.js.');
