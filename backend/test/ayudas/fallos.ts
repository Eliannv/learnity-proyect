// Inyección de fallos de disco y de BD usando los seams acordados con be-b (RG-06/H9):
//  - disco: se sustituyen propiedades de `almacenLocal` (la producción siempre llama `almacenLocal.<método>()`);
//  - BD: se envuelve `pool.connect` para que el cliente de una transacción falle tras su primera escritura.
// Toda inyección se restaura con `restaurar()` (usar en finally/after) y expone un contador de llamadas:
// `exigirLlamado()` falla la prueba si el doble nunca se ejecutó (SEG-27).
import type pg from 'pg';

type Fn = (...args: any[]) => any;

export interface Inyeccion {
  llamadas(): number;
  exigirLlamado(): void;
  restaurar(): void;
}

export function exigirLlamado(nombre: string, llamadas: number): void {
  if (llamadas <= 0) throw new Error(`El doble "${nombre}" no se llamó: la prueba no ejercitó el fallo (SEG-27).`);
}

/** Sustituye `objeto[metodo]` por `hacer(original, ...args)`. */
export function inyectarMetodo(objeto: object, metodo: string, hacer: (original: Fn, ...args: any[]) => any): Inyeccion {
  const destino = objeto as Record<string, Fn>;
  const original = destino[metodo]!;
  let n = 0;
  destino[metodo] = (...args: any[]) => {
    n++;
    return hacer(original.bind(objeto), ...args);
  };
  return {
    llamadas: () => n,
    exigirLlamado: () => exigirLlamado(metodo, n),
    restaurar: () => { destino[metodo] = original; },
  };
}

export const errorDisco = (code: string) => Object.assign(new Error(`${code}: fallo de disco simulado`), { code, syscall: 'write' });
export const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ModoFalloBd = 'error' | 'terminar-conexion';

/**
 * Hace que la PRIMERA transacción (cliente de `pool.connect`) falle justo después de su primera escritura
 * (INSERT/UPDATE/DELETE): con 'error' la siguiente consulta (incluido el COMMIT) lanza; con 'terminar-conexion'
 * antes se mata la propia sesión con pg_terminate_backend(pg_backend_pid()).
 */
export function inyectarFalloBd(pool: pg.Pool, modo: ModoFalloBd): Inyeccion {
  const original = pool.connect.bind(pool) as () => Promise<pg.PoolClient>;
  let disparos = 0;
  let activo = true;
  (pool as unknown as { connect: Fn }).connect = async (...args: unknown[]) => {
    // pg-pool usa connect(callback) por dentro en pool.query(): ese camino no se toca.
    if (typeof args[0] === 'function') return (original as Fn)(...args);
    const cliente = await (original as Fn)(...args) as pg.PoolClient;
    if (!activo) return cliente;
    const consultaOriginal = cliente.query.bind(cliente) as Fn;
    const liberarOriginal = cliente.release.bind(cliente) as Fn;
    let escribio = false;
    let disparado = false;
    (cliente as unknown as { query: Fn }).query = async (...q: any[]) => {
      const sql = String(typeof q[0] === 'string' ? q[0] : q[0]?.text ?? '');
      if (escribio && !disparado && !/^\s*ROLLBACK/i.test(sql)) {
        disparado = true;
        disparos++;
        if (modo === 'terminar-conexion') {
          try { await consultaOriginal('SELECT pg_terminate_backend(pg_backend_pid())'); } catch { /* la sesión murió */ }
          return consultaOriginal(...q);
        }
        throw Object.assign(new Error('fallo de BD simulado'), { code: '08006' });
      }
      const r = await consultaOriginal(...q);
      if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) escribio = true;
      return r;
    };
    (cliente as unknown as { release: Fn }).release = (...r: unknown[]) => {
      (cliente as unknown as { query: Fn }).query = consultaOriginal;
      (cliente as unknown as { release: Fn }).release = liberarOriginal;
      return liberarOriginal(...r);
    };
    return cliente;
  };
  return {
    llamadas: () => disparos,
    exigirLlamado: () => exigirLlamado(`pool.connect/${modo}`, disparos),
    restaurar: () => { activo = false; (pool as unknown as { connect: Fn }).connect = original; },
  };
}
