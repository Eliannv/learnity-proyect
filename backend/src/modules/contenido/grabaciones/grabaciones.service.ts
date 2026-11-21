import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { registrarEvento } from '../../../shared/log/registro.js';
import { storagePrivado } from './grabaciones.storage.js';
import type { PoolClient } from 'pg';
import { identidadApi } from '../../identidad/index.js';
import { AppError } from '../../../shared/http/app-error.js';
import { env } from '../../../shared/config/env.js';
import type { UsuarioSesion } from '../../../shared/auth/tipos.js';
import { enTransaccion } from '../../../shared/database/pool.js';
import { grabacionesRepository as repo, type OrigenGrabacion } from './grabaciones.repository.js';
import { TAMANO_PARTE, validarMp4 } from './grabaciones.formato.js';

const denegar = () => AppError.noEncontrado('Grabación no disponible.');
async function subida(db: PoolClient, id: string, usuario: UsuarioSesion) {
  const curso = await repo.cursoDeCarga(db, id, usuario.idPersona);
  if (
    !curso ||
    !usuario.roles.includes('DOCENTE') ||
    !(await repo.cursoEditable(db, curso, usuario.idPersona))
  )
    throw denegar();
  const g = await repo.buscar(db, id, usuario.idPersona);
  if (!g) throw denegar();
  return g;
}
async function visible(db: PoolClient, leccion: number, u: UsuarioSesion) {
  const g = await repo.deLeccion(
    db,
    leccion,
    u.idPersona,
    u.roles.includes('DOCENTE'),
    u.roles.includes('ADMIN'),
    u.roles.includes('ESTUDIANTE'),
  );
  if (!g) throw denegar();
  return g;
}
async function leerFragmento(
  db: PoolClient,
  g: OrigenGrabacion,
  inicio: number,
  longitud: number,
): Promise<Buffer> {
  if (!g.bucket) return repo.leer(db, g.id, inicio, longitud);
  const fin = inicio + longitud;
  const fragmentos: Buffer[] = [];
  for (let numero = Math.floor(inicio / TAMANO_PARTE); numero * TAMANO_PARTE < fin; numero++) {
    const base = numero * TAMANO_PARTE;
    const bytes = await storagePrivado.leer(
      g.bucket,
      g.clave,
      numero,
      Math.min(TAMANO_PARTE, g.tamano - base),
    );
    const esperada = await repo.huella(db, g.id, numero);
    if (!esperada?.equals(createHash('sha256').update(bytes).digest())) {
      throw new AppError(503, 'El almacén no devolvió el bloque esperado.', 'GRABACION_INCOMPLETA');
    }
    fragmentos.push(bytes.subarray(Math.max(0, inicio - base), Math.min(bytes.length, fin - base)));
  }
  return Buffer.concat(fragmentos);
}

export const DURACION_PASE = 10 * 60;
const firma = { issuer: 'learnity-api', audience: 'learnity-reproduccion' };
export const grabacionesService = {
  async limpiarHuerfanas() {
    const pendientes = await enTransaccion(async (db) => {
      await repo.depurar(db, null);
      return repo.retiradas(db);
    });
    for (const obj of pendientes) {
      try {
        await storagePrivado.retirar(obj.bucket, obj.clave, obj.partes);
        await enTransaccion((db) => repo.confirmarRetirada(db, obj.clave));
      } catch {
        registrarEvento('grabacion.limpieza_pendiente', {}, 'aviso');
      }
    }
  },
  iniciar(curso: number, id: string, tamano: number, u: UsuarioSesion) {
    return enTransaccion(
      async (db) => {
        if (!u.roles.includes('DOCENTE') || !(await repo.cursoEditable(db, curso, u.idPersona)))
          throw denegar();
        await repo.depurar(db, curso);
        const bucket = env.VIDEO_ALMACEN === 'supabase' ? env.VIDEO_SUPABASE_BUCKET : null;
        await repo.iniciar(db, id, curso, u.idPersona, tamano, bucket);
        const g = await repo.buscar(db, id, u.idPersona);
        if (!g || g.curso !== curso || g.tamano !== tamano)
          throw AppError.conflicto('Elige nuevamente el archivo.');
        if (g.bucket) await storagePrivado.comprobarBucket(g.bucket);
        return { id, siguiente: g.siguiente, lista: g.lista, tamanoParte: TAMANO_PARTE };
      },
      { actor: u.idPersona },
    );
  },
  comprobarSubida(id: string, u: UsuarioSesion) {
    return enTransaccion(async (db) => {
      await subida(db, id, u);
    });
  },
  guardar(id: string, numero: number, bytes: Buffer, u: UsuarioSesion) {
    return enTransaccion(async (db) => {
      const g = await subida(db, id, u);
      const longitud = Math.min(TAMANO_PARTE, g.tamano - numero * TAMANO_PARTE);
      if (!Buffer.isBuffer(bytes) || longitud <= 0 || bytes.length !== longitud)
        throw AppError.solicitudInvalida('El bloque tiene un tamaño incorrecto.');
      const huella = createHash('sha256').update(bytes).digest();
      if (numero < g.siguiente && (await repo.huella(db, id, numero))?.equals(huella)) return;
      if (g.lista || numero !== g.siguiente)
        throw AppError.conflicto('Reanuda la carga desde el último bloque confirmado.');
      if (g.bucket) await storagePrivado.guardar(g.bucket, g.clave, numero, bytes);
      await repo.parte(db, id, numero, g.bucket ? null : bytes, huella);
    });
  },
  confirmar(id: string, u: UsuarioSesion) {
    return enTransaccion(
      async (db) => {
        const g = await subida(db, id, u);
        if (g.lista) return { id };
        if (g.siguiente !== Math.ceil(g.tamano / TAMANO_PARTE))
          throw AppError.conflicto('La carga está incompleta.');
        // Se consultan bloques completos solo al cruzar su límite durante la lectura de metadatos MP4.
        let numeroAnterior = -1,
          bloque = Buffer.alloc(0) as Buffer;
        const leer = async (pos: number, n: number): Promise<Buffer> => {
          const numero = Math.floor(pos / TAMANO_PARTE);
          if (numero !== numeroAnterior) {
            bloque = await leerFragmento(
              db,
              g,
              numero * TAMANO_PARTE,
              Math.min(TAMANO_PARTE, g.tamano - numero * TAMANO_PARTE),
            );
            numeroAnterior = numero;
          }
          const offset = pos % TAMANO_PARTE;
          if (offset + n <= bloque.length) return bloque.subarray(offset, offset + n);
          return leerFragmento(db, g, pos, n);
        };
        await validarMp4(g.tamano, leer);
        await repo.confirmar(db, id);
        return { id };
      },
      { actor: u.idPersona },
    );
  },
  emitir(leccion: number, u: UsuarioSesion) {
    return enTransaccion(async (db) => {
      const g = await visible(db, leccion, u);
      return jwt.sign({ sid: u.sid, persona: u.idPersona, leccion, grabacion: g.id }, env.JWT_SECRET, {
        ...firma,
        algorithm: 'HS256',
        subject: String(u.idUsuario),
        expiresIn: DURACION_PASE,
      });
    });
  },
  async reproducir(leccion: number, token: unknown) {
    let p: jwt.JwtPayload;
    try {
      if (typeof token !== 'string') throw Error();
      p = jwt.verify(token, env.JWT_SECRET, { ...firma, algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (p.leccion !== leccion || typeof p.sid !== 'string' || typeof p.grabacion !== 'string')
        throw Error();
    } catch {
      throw AppError.noAutenticado('Renueva el acceso al vídeo.');
    }
    const u: UsuarioSesion = {
      idUsuario: Number(p.sub),
      idPersona: p.persona,
      sid: p.sid,
      roles: [],
      correo: '',
    };
    const comprobar = async () => {
      if (!p.exp || Date.now() >= p.exp * 1000) throw AppError.noAutenticado('Renueva el acceso al vídeo.');
      const roles = await identidadApi.sesionVigente(u);
      if (!roles) throw AppError.noAutenticado();
      u.roles = roles;
    };
    await comprobar();
    const g = await enTransaccion((db) => visible(db, leccion, u));
    if (g.id !== p.grabacion) throw denegar();
    return {
      tamano: g.tamano,
      leer: async (inicio: number, n: number) => {
        await comprobar();
        return enTransaccion(async (db) => {
          if ((await visible(db, leccion, u)).id !== g.id) throw denegar();
          return leerFragmento(db, g, inicio, n);
        });
      },
    };
  },
};
