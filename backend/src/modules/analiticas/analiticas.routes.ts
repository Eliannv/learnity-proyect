import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { validarConsulta } from '../../shared/http/validar.js';
import { analiticasController as controller } from './analiticas.controller.js';
import { filtrosAnaliticas } from './analiticas.esquemas.js';

// Analíticas del docente: rendimiento de sus cursos (solo lectura).
export const analiticasRoutes = Router();

analiticasRoutes.get('/docente/analiticas', autenticar, autorizar('DOCENTE'),
  validarConsulta(filtrosAnaliticas), controller.obtener);
