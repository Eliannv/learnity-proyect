import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../../../shared/config/env.js';
import { datosValidados } from '../../../shared/http/validar.js';
import { DURACION_PASE, grabacionesService as servicio } from './grabaciones.service.js';
import { rangoVideo, TAMANO_PARTE } from './grabaciones.formato.js';

const idRuta = (res: Response) => datosValidados<number>(res).parametros;
const carga = (res: Response) => datosValidados<{ carga: string; parte: number }>(res).parametros;
const cookie = 'learnity_video';
export const grabacionesController = {
  async iniciar(req: Request, res: Response) {
    res
      .status(201)
      .json(await servicio.iniciar(idRuta(res), req.body.operacion, req.body.tamano, req.usuario!));
  },
  async autorizarParte(req: Request, res: Response, next: NextFunction) {
    await servicio.comprobarSubida(carga(res).carga, req.usuario!);
    next();
  },
  async guardar(req: Request, res: Response) {
    const { carga: id, parte } = carga(res);
    await servicio.guardar(id, parte, req.body, req.usuario!);
    res.sendStatus(204);
  },
  async confirmar(req: Request, res: Response) {
    res.json(await servicio.confirmar(carga(res).carga, req.usuario!));
  },
  async sesion(req: Request, res: Response) {
    const id = idRuta(res),
      path = `/api/lecciones/${id}/video`;
    res.cookie(cookie, await servicio.emitir(id, req.usuario!), {
      path,
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: DURACION_PASE * 1000,
    });
    res.set('Cache-Control', 'private, no-store').sendStatus(204);
  },
  async video(req: Request, res: Response) {
    res.set('Cache-Control', 'private, no-store');
    const archivo = await servicio.reproducir(idRuta(res), req.cookies?.[cookie]);
    res.set({ 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4', 'X-Content-Type-Options': 'nosniff' });
    const rango = req.get('range');
    if (rango) {
      const r = rangoVideo(rango, archivo.tamano);
      if (!r) {
        res.status(416).set('Content-Range', `bytes */${archivo.tamano}`).end();
        return;
      }
      const n = r.fin - r.inicio + 1;
      res
        .status(206)
        .set({
          'Content-Range': `bytes ${r.inicio}-${r.fin}/${archivo.tamano}`,
          'Content-Length': String(n),
        });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(await archivo.leer(r.inicio, n));
      return;
    }
    res.set('Content-Length', String(archivo.tamano));
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    async function* bloques() {
      for (let inicio = 0; inicio < archivo.tamano; inicio += TAMANO_PARTE) {
        yield await archivo.leer(inicio, Math.min(TAMANO_PARTE, archivo.tamano - inicio));
      }
    }
    await pipeline(Readable.from(bloques()), res);
  },
};
