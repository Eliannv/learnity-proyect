import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarParametros } from '../../shared/http/validar.js';
import { contenidoController as controller } from './contenido.controller.js';
import { idContenidoRuta } from './contenido.esquemas.js';
import { recibirPdf, recibirRecurso } from './contenido.multipart.js';

export const contenidoRoutes = Router();

// Orden de middlewares (PLANTILLA_MODULO §3, ADR-011 11.4):
// limitarPorIp → autenticar → autorizar → validarParametros → autorizarCarga (verifica propiedad/estado antes de leer el multipart) → recibirPdf → subir.
contenidoRoutes.post(
  '/lecciones/:id/archivo',
  limitarPorIp('subida-pdf', 30, 15),
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idContenidoRuta),
  controller.autorizarCarga,
  recibirPdf,
  controller.subir,
);

// Recurso adjunto (PDF, PPT, PPTX o ZIP), mismo orden de middlewares que el PDF principal.
contenidoRoutes.post(
  '/lecciones/:id/recursos',
  limitarPorIp('subida-pdf', 30, 15),
  autenticar,
  autorizar('DOCENTE'),
  validarParametros(idContenidoRuta),
  controller.autorizarCarga,
  recibirRecurso,
  controller.subirRecurso,
);

contenidoRoutes.get(
  '/archivos/:id',
  autenticar,
  autorizar('DOCENTE', 'ADMIN', 'ESTUDIANTE'),
  validarParametros(idContenidoRuta),
  controller.descargar,
);
