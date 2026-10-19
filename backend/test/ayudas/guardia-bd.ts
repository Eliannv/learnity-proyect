// Guarda de BD para toda suite. Debe ser el PRIMER import, antes de src/app.js y de pool.js
// (que cargan dotenv): import './ayudas/guardia-bd.js';
// En el `before` de cada suite, además: await verificarBaseConectada(pool).
import { comprobarEntorno } from './guardia-entorno.js';

export { comprobarEntorno, nombreBaseValido, verificarBaseConectada } from './guardia-entorno.js';

const error = comprobarEntorno(process.env);
if (error) throw new Error(`Guarda de pruebas: ${error}`);
