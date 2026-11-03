import { env } from '../config/env.js';
import { consultar } from '../database/pool.js';

/**
 * Respaldo en memoria solo cuando la base local de pruebas aún no tiene aplicada la migración 040 (código 42P01).
 * En producción (Supabase) y en cualquier base con la 040 aplicada, todo pasa por la tabla `archivo_binario`.
 */
const memoriaSinTabla = new Map<string, Buffer>();

function sinTablaDisponible(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'ECONNREFUSED';
}

function habilitado(): boolean {
  return env.NODE_ENV !== 'test' || binarioRepository.activoEnPruebas;
}

export const binarioRepository = {
  activoEnPruebas: false,

  async guardar(nombre: string, bytes: Buffer): Promise<void> {
    if (!habilitado()) return;
    try {
      await consultar(
        `
          INSERT INTO archivo_binario (nombre, bytes)
          VALUES ($1, $2)
          ON CONFLICT (nombre)
          DO UPDATE SET bytes = EXCLUDED.bytes, creado_en = now()
        `,
        [nombre, bytes],
      );
      memoriaSinTabla.delete(nombre);
    } catch (error) {
      if (sinTablaDisponible(error)) {
        memoriaSinTabla.set(nombre, Buffer.from(bytes));
        return;
      }
      throw error;
    }
  },

  async leer(nombre: string): Promise<Buffer | null> {
    if (!habilitado()) return null;
    try {
      const { rows } = await consultar<{ bytes: Buffer }>(
        'SELECT bytes FROM archivo_binario WHERE nombre = $1',
        [nombre],
      );
      return rows[0]?.bytes ?? memoriaSinTabla.get(nombre) ?? null;
    } catch (error) {
      if (sinTablaDisponible(error)) {
        return memoriaSinTabla.get(nombre) ?? null;
      }
      return null;
    }
  },

  async eliminar(nombre: string): Promise<void> {
    memoriaSinTabla.delete(nombre);
    if (!habilitado()) return;
    try {
      await consultar('DELETE FROM archivo_binario WHERE nombre = $1', [nombre]);
    } catch (error) {
      if (sinTablaDisponible(error)) return;
      throw error;
    }
  },
};
