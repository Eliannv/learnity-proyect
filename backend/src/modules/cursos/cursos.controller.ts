import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/http/app-error.js';
import { idRuta } from '../../shared/http/esquemas.js';
import { cursosService } from './cursos.service.js';
import {
  datosCursoSchema,
  datosLeccionSchema,
  datosModuloSchema,
} from './cursos-gestion.esquemas.js';

const repetible = <T extends z.ZodType>(elemento: T) => z.union([elemento, z.array(elemento).min(1).max(20)])
  .transform((valor) => Array.isArray(valor) ? valor : [valor]);

const filtros = z.strictObject({
  q: z.string().trim().max(100).optional(),
  categoria: repetible(z.string().min(1).max(80)).optional(),
  nivel: repetible(z.enum(['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'])).optional(),
  orden: z.enum(['recientes', 'populares', 'az']).default('recientes'),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(9),
});

const idCurso = z.object({ id: idRuta }).transform(({ id }) => id);

export const cursosController = {
  async crearCurso(req: Request, res: Response) {
    const usuario = req.usuario;

    if (!usuario) {
      throw AppError.noAutenticado();
    }

    const validacion = datosCursoSchema.safeParse(
      req.body,
    );

    if (!validacion.success) {
      throw AppError.solicitudInvalida(
        'Revisa los datos enviados.',
        validacion.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      );
    }

    const curso = await cursosService.crearCurso(
      validacion.data,
      usuario,
    );

    res.status(201).json(curso);
  },

  async crearModulo(req: Request, res: Response) {
    const id = idCurso.parse(req.params);

    const usuario = req.usuario;

    if (!usuario) {
      throw AppError.noAutenticado();
    }

    const validacion = datosModuloSchema.safeParse(
      req.body,
    );

    if (!validacion.success) {
      throw AppError.solicitudInvalida(
        'Revisa los datos del módulo.',
        validacion.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      );
    }

    const curso = await cursosService.crearModulo(
      id,
      validacion.data,
      usuario,
    );

    res.status(201).json(curso);
  },

  async crearLeccion(req: Request, res: Response) {
    const id = idCurso.parse(req.params);

    if (!req.usuario) {
      throw AppError.noAutenticado();
    }

    const validacion = datosLeccionSchema.safeParse(
      req.body,
    );

    if (!validacion.success) {
      throw AppError.solicitudInvalida(
        'Revisa los datos de la lección.',
        validacion.error.issues.map(issue => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      );
    }

    const curso = await cursosService.crearLeccion(
      id,
      validacion.data,
      req.usuario,
    );

    res.status(201).json(curso);
  },

  async actualizarLeccion(
    req: Request,
    res: Response,
  ) {
    const id = idCurso.parse(req.params);

    if (!req.usuario) {
      throw AppError.noAutenticado();
    }

    const validacion = datosLeccionSchema.safeParse(
      req.body,
    );

    if (!validacion.success) {
      throw AppError.solicitudInvalida(
        'Revisa los datos de la lección.',
        validacion.error.issues.map(issue => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      );
    }

    const curso = await cursosService.actualizarLeccion(
      id,
      validacion.data,
      req.usuario,
    );

    res.status(200).json(curso);
  },

  async eliminarLeccion(
    req: Request,
    res: Response,
  ) {
    const id = idCurso.parse(req.params);

    if (!req.usuario) {
      throw AppError.noAutenticado();
    }

    const curso = await cursosService.eliminarLeccion(
      id,
      req.usuario,
    );

    res.status(200).json(curso);
  },

  async eliminarModulo(
    req: Request,
    res: Response,
  ) {
    const id = idCurso.parse(req.params);

    if (!req.usuario) {
      throw AppError.noAutenticado();
    }

    const curso = await cursosService.eliminarModulo(
      id,
      req.usuario,
    );

    res.status(200).json(curso);
  },

  async actualizarModulo(
    req: Request,
    res: Response,
  ) {
    const id = idCurso.parse(req.params);

    if (!req.usuario) {
      throw AppError.noAutenticado();
    }

    const resultado = datosModuloSchema.safeParse(
      req.body,
    );

    if (!resultado.success) {
      throw AppError.solicitudInvalida(
        'Revisa los datos del módulo.',
        resultado.error.issues.map(issue => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      );
    }

    const curso = await cursosService.actualizarModulo(
      id,
      resultado.data,
      req.usuario,
    );

    res.status(200).json(curso);
  },

  async actualizarMiCurso(
    req: Request,
    res: Response,
  ) {
    const id = idCurso.parse(req.params);

    const usuario = req.usuario;

    if (!usuario) {
      throw AppError.noAutenticado();
    }

    const validacion = datosCursoSchema.safeParse(
      req.body,
    );

    if (!validacion.success) {
      throw AppError.solicitudInvalida(
        'Revisa los datos enviados.',
        validacion.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      );
    }

    const curso =
      await cursosService.actualizarMiCurso(
        id,
        validacion.data,
        usuario,
      );

    res.status(200).json(curso);
  },

  async enviarCursoARevision(
    req: Request,
    res: Response,
  ) {
    const id = idCurso.parse(req.params);

    if (!req.usuario) {
      throw AppError.noAutenticado();
    }

    const resultado =
      await cursosService.enviarCursoARevision(
        id,
        req.usuario,
      );

    res.status(200).json(resultado);
  },

  async listarMisCursos(req: Request, res: Response) {
    const usuario = req.usuario;

    if (!usuario) {
      throw new Error('La ruta requiere autenticación.');
    }

    const resultado =
      await cursosService.listarMisCursos(usuario);

    res.status(200).json(resultado);
  },

  async obtenerMiCurso(req: Request, res: Response) {
    const id = idCurso.parse(req.params);

    const usuario = req.usuario;

    if (!usuario) {
      throw AppError.noAutenticado();
    }

    const resultado =
      await cursosService.obtenerMiCurso(id, usuario);

    res.status(200).json(resultado);
  },

  async categorias(_req: Request, res: Response) {
    res.json(await cursosService.categoriasPublicas());
  },

  async catalogo(req: Request, res: Response) {
    const datos = filtros.parse(req.query);
    res.json(await cursosService.catalogoPublico({
      q: datos.q,
      categorias: datos.categoria ?? [],
      niveles: datos.nivel ?? [],
      orden: datos.orden,
      pagina: datos.pagina,
      limite: datos.limite,
    }));
  },

  async detalle(req: Request, res: Response) {
    const id = idCurso.parse(req.params);
    res.json(await cursosService.detallePublico(id));
  },
};
