import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Valida el cuerpo de la petición con un esquema de zod antes de llegar al controller.
 * Uso en routes:  router.post('/auth/login', validarCuerpo(loginSchema), controller.login)
 */
export function validarCuerpo(esquema: ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = esquema.parse(req.body);
    next();
  };
}
