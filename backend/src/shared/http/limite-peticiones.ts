import type { RequestHandler } from 'express';
import { registrarEvento } from '../log/registro.js';
import { AppError } from './app-error.js';

interface Ventana {
  inicio: number;
  cuenta: number;
}

const limitadores: Map<string, Ventana>[] = [];

/**
 * Límite de peticiones por IP y ruta (ventana fija, en memoria).
 * Sirve para un solo proceso del monolito; si un día hay varias instancias, mover el contador a la base o a Redis.
 * Con un proxy inverso delante, configurar TRUST_PROXY para que `req.ip` sea la IP real del cliente.
 */
export function limitarPorIp(nombre: string, maximo: number, ventanaMinutos: number): RequestHandler {
  const ventanaMs = ventanaMinutos * 60_000;
  const contadores = new Map<string, Ventana>();
  limitadores.push(contadores);

  return (req, res, next) => {
    const ahora = Date.now();
    const clave = req.ip ?? 'desconocida';
    let ventana = contadores.get(clave);
    if (!ventana || ahora - ventana.inicio >= ventanaMs) {
      ventana = { inicio: ahora, cuenta: 0 };
      contadores.set(clave, ventana);
    }
    ventana.cuenta++;
    if (ventana.cuenta > maximo) {
      const segundos = Math.ceil((ventana.inicio + ventanaMs - ahora) / 1000);
      res.setHeader('Retry-After', String(segundos));
      if (ventana.cuenta === maximo + 1) registrarEvento('limite_ip_superado', { ruta: nombre, ip: clave }, 'aviso');
      throw AppError.demasiadasPeticiones(segundos);
    }
    // Limpieza ocasional para que el mapa no crezca sin fin.
    if (contadores.size > 10_000) {
      for (const [ip, v] of contadores) if (ahora - v.inicio >= ventanaMs) contadores.delete(ip);
    }
    next();
  };
}

/** Solo para pruebas automáticas: reinicia todos los contadores. */
export function reiniciarLimites(): void {
  for (const contadores of limitadores) contadores.clear();
}
