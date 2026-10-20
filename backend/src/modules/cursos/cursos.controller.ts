import type { Request, Response } from 'express';
import type { UsuarioSesion } from '../../shared/auth/tipos.js';
import { AppError } from '../../shared/http/app-error.js';
import { datosValidados } from '../../shared/http/validar.js';
import type { DatosCurso, DatosLeccion, DatosModulo } from './cursos.esquemas.js';
import { cursosService } from './cursos.service.js';

function usuario(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw AppError.noAutenticado();
  }
  return req.usuario;
}

export const cursosController = {
  async crearCurso(req: Request, res: Response) {
    const curso = await cursosService.crearCurso(req.body as DatosCurso, usuario(req));
    res.status(201).json(curso);
  },

  async crearModulo(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.crearModulo(id, req.body as DatosModulo, usuario(req));
    res.status(201).json(curso);
  },

  async crearLeccion(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.crearLeccion(id, req.body as DatosLeccion, usuario(req));
    res.status(201).json(curso);
  },

  async actualizarLeccion(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.actualizarLeccion(id, req.body as DatosLeccion, usuario(req));
    res.status(200).json(curso);
  },

  async eliminarLeccion(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.eliminarLeccion(id, usuario(req));
    res.status(200).json(curso);
  },

  async eliminarModulo(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.eliminarModulo(id, usuario(req));
    res.status(200).json(curso);
  },

  async actualizarModulo(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.actualizarModulo(id, req.body as DatosModulo, usuario(req));
    res.status(200).json(curso);
  },

  async actualizarMiCurso(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const curso = await cursosService.actualizarMiCurso(id, req.body as DatosCurso, usuario(req));
    res.status(200).json(curso);
  },

  async enviarCursoARevision(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const resultado = await cursosService.enviarCursoARevision(id, usuario(req));
    res.status(200).json(resultado);
  },

  async listarMisCursos(req: Request, res: Response) {
    const resultado = await cursosService.listarMisCursos(usuario(req));
    res.status(200).json(resultado);
  },

  async obtenerMiCurso(req: Request, res: Response) {
    const { parametros: id } = datosValidados<number>(res);
    const resultado = await cursosService.obtenerMiCurso(id, usuario(req));
    res.status(200).json(resultado);
  },
};
