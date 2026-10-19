// Generadores de datos de prueba. Todo lleva la marca de la suite para poder aislarlo y limpiarlo.
// Los correos NUNCA usan @pruebas.test: identidad.test.ts borra todas las cuentas de ese dominio.

export const DOMINIO_CORREO = 'qa-edge.test';

export function crearMarca(prefijo: string): string {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generadorCorreos(marca: string) {
  let n = 0;
  return (etiqueta = 'u') => `${marca}.${etiqueta}${++n}@${DOMINIO_CORREO}`.toLowerCase();
}

export const CONTRASENA_PRUEBA = 'Qa-Edge#2026-clave-larga';
