import { Router } from 'express';
import { autenticar } from '../../shared/auth/middlewares.js';
import { validarCuerpo } from '../../shared/http/validar.js';
import { identidadController } from './identidad.controller.js';
import {
  actualizarPerfilSchema,
  cambiarContrasenaSchema,
  loginSchema,
  recuperarSchema,
  registroSchema,
  restablecerSchema,
} from './identidad.esquemas.js';

// Capa routes: URL, verbo HTTP, middlewares (sesión, rol, validación) y controller.
export const identidadRoutes = Router();

identidadRoutes.post('/auth/registro', validarCuerpo(registroSchema), identidadController.registrar);
identidadRoutes.post('/auth/login', validarCuerpo(loginSchema), identidadController.iniciarSesion);
identidadRoutes.post('/auth/recuperar', validarCuerpo(recuperarSchema), identidadController.solicitarRecuperacion);
identidadRoutes.post('/auth/restablecer', validarCuerpo(restablecerSchema), identidadController.restablecerContrasena);

identidadRoutes.get('/perfil', autenticar, identidadController.obtenerPerfil);
identidadRoutes.put('/perfil', autenticar, validarCuerpo(actualizarPerfilSchema), identidadController.actualizarPerfil);
identidadRoutes.put(
  '/perfil/contrasena',
  autenticar,
  validarCuerpo(cambiarContrasenaSchema),
  identidadController.cambiarContrasena,
);
