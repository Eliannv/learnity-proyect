import { Router, raw } from 'express';
import { z } from 'zod';
import { autenticar, autorizar } from '../../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../../shared/http/limite-peticiones.js';
import { validarCuerpo, validarParametros } from '../../../shared/http/validar.js';
import { idContenidoRuta } from '../contenido.esquemas.js';
import { grabacionesController as c } from './grabaciones.controller.js';
import { MAX_VIDEO, TAMANO_PARTE } from './grabaciones.formato.js';

export const grabacionesRoutes = Router();
const docente = [autenticar, autorizar('DOCENTE')];
const carga = z.object({ carga: z.uuid() });
grabacionesRoutes.post(
  '/docente/cursos/:id/grabaciones',
  limitarPorIp('iniciar-grabacion', 60, 15),
  ...docente,
  validarParametros(idContenidoRuta),
  validarCuerpo(z.strictObject({ operacion: z.uuid(), tamano: z.number().int().positive().max(MAX_VIDEO) })),
  c.iniciar,
);
grabacionesRoutes.put(
  '/grabaciones/:carga/partes/:parte',
  ...docente,
  validarParametros(carga.extend({ parte: z.coerce.number().int().min(0).max(99) })),
  c.autorizarParte,
  raw({ type: 'application/octet-stream', limit: TAMANO_PARTE, inflate: false }),
  c.guardar,
);
grabacionesRoutes.post('/grabaciones/:carga/confirmar', ...docente, validarParametros(carga), c.confirmar);
grabacionesRoutes.post(
  '/lecciones/:id/video/sesion',
  autenticar,
  validarParametros(idContenidoRuta),
  c.sesion,
);
grabacionesRoutes.get('/lecciones/:id/video', validarParametros(idContenidoRuta), c.video);
