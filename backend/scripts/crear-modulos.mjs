// Genera la estructura en capas de un módulo vacío: node scripts/crear-modulos.mjs <nombre> "<descripción>" "<rutas previstas>"
// Uso interno para mantener la misma forma en todos los módulos.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , nombre, descripcion, rutas = ''] = process.argv;
if (!nombre) {
  console.error('Uso: node scripts/crear-modulos.mjs <nombre> "<descripción>" "<rutas previstas separadas por ;>"');
  process.exit(1);
}
const Nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
const dir = join('src', 'modules', nombre);
if (existsSync(dir)) {
  console.error(`El módulo ${nombre} ya existe.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const listaRutas = rutas
  .split(';')
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => `//   ${r}`)
  .join('\n');

const archivos = {
  [`${nombre}.routes.ts`]: `import { Router } from 'express';
// import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
// import { ${nombre}Controller } from './${nombre}.controller.js';

// Módulo ${Nombre} · ${descripcion}
// Rutas previstas (se implementan en su sprint):
${listaRutas || '//   (por definir)'}
export const ${nombre}Routes = Router();
`,
  [`${nombre}.controller.ts`]: `// import type { Request, Response } from 'express';
// import { ${nombre}Service } from './${nombre}.service.js';

// Capa controller del módulo ${Nombre}: recibe la petición, llama al service y responde.
export const ${nombre}Controller = {};
`,
  [`${nombre}.service.ts`]: `// import { ${nombre}Repository } from './${nombre}.repository.js';
// import { AppError } from '../../shared/http/app-error.js';

// Capa service del módulo ${Nombre}: reglas del negocio.
// Si necesita datos de otro módulo, llama al service de ese módulo, nunca a su repository.
export const ${nombre}Service = {};
`,
  [`${nombre}.repository.ts`]: `// import { consultar, enTransaccion } from '../../shared/database/pool.js';

// Capa repository del módulo ${Nombre}: solo consultas SQL parametrizadas ($1, $2…).
export const ${nombre}Repository = {};
`,
};

for (const [archivo, contenido] of Object.entries(archivos)) {
  writeFileSync(join(dir, archivo), contenido, 'utf8');
}
console.log(`Módulo ${nombre} creado en ${dir}`);
