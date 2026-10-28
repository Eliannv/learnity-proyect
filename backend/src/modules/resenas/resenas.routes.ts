import { Router } from 'express';
import { autenticar, autorizar } from '../../shared/auth/middlewares.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarConsulta, validarCuerpo, validarParametros } from '../../shared/http/validar.js';
import { resenasController as controller } from './resenas.controller.js';
import { datosResena, idCursoResenas, paginacionResenas } from './resenas.esquemas.js';

// Reseñas de cursos: la lectura es pública; escribir exige estar inscrito en el curso publicado.
export const resenasRoutes = Router();

resenasRoutes.get('/cursos/:id/resenas', validarParametros(idCursoResenas),
  validarConsulta(paginacionResenas), controller.listar);
resenasRoutes.get('/cursos/:id/resena', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idCursoResenas), controller.mia);
resenasRoutes.put('/cursos/:id/resena', limitarPorIp('resena', 30, 15), autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idCursoResenas), validarCuerpo(datosResena, 'Revisa tu reseña.'), controller.guardar);
resenasRoutes.delete('/cursos/:id/resena', autenticar, autorizar('ESTUDIANTE'),
  validarParametros(idCursoResenas), controller.eliminar);
