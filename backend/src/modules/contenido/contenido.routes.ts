import { Router } from 'express';
// import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
// import { contenidoController } from './contenido.controller.js';

// Módulo Contenido · Archivos multimedia: videos, PDF y PowerPoint.
// Rutas previstas (se implementan en su sprint):
//   POST /lecciones/:id/archivo (Multer + FFmpeg: MP4 <= 5 MB y 480p
//   PDF/PPT <= 10 MB)
//   POST /lecciones/:id/adjuntos (máximo 3)
//   GET /archivos/:id (solo usuarios autorizados)
export const contenidoRoutes = Router();
