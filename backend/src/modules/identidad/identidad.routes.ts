import { Router } from 'express';
import { autenticar } from '../../shared/auth/middlewares.js';
import { env } from '../../shared/config/env.js';
import { exigirCsrf, verificarOrigen } from '../../shared/http/cookies-sesion.js';
import { limitarPorIp } from '../../shared/http/limite-peticiones.js';
import { validarCuerpo } from '../../shared/http/validar.js';
import { identidadController } from './identidad.controller.js';
import { recibirFoto } from './identidad.multipart.js';
import {
  actualizarPerfilSchema,
  cambiarContrasenaSchema,
  loginSchema,
  recuperarSchema,
  registroSchema,
  restablecerSchema,
} from './identidad.esquemas.js';

// Capa routes: URL, verbo HTTP, middlewares (origen, límite por IP, CSRF, sesión, validación) y controller.
// El bloqueo por cuenta (5 fallos → 15 min) es una regla del negocio y está en el service.
export const identidadRoutes = Router();

const auth = Router();
auth.use(verificarOrigen);

auth.post('/registro', limitarPorIp('registro', 10, 60), validarCuerpo(registroSchema), identidadController.registrar);
auth.post('/login', limitarPorIp('login', env.LOGIN_MAX_POR_IP, 15), validarCuerpo(loginSchema), identidadController.iniciarSesion);
auth.post('/refresh', limitarPorIp('refresh', 120, 15), exigirCsrf, identidadController.refrescarSesion);
auth.post('/logout', limitarPorIp('logout', 60, 15), exigirCsrf, identidadController.cerrarSesion);
auth.post('/recuperar', limitarPorIp('recuperar', 5, 15), validarCuerpo(recuperarSchema), identidadController.solicitarRecuperacion);
auth.post('/restablecer', limitarPorIp('restablecer', 10, 15), validarCuerpo(restablecerSchema), identidadController.restablecerContrasena);

identidadRoutes.use('/auth', auth);

identidadRoutes.get('/perfil', autenticar, identidadController.obtenerPerfil);
identidadRoutes.put('/perfil', autenticar, validarCuerpo(actualizarPerfilSchema), identidadController.actualizarPerfil);
identidadRoutes.put('/perfil/foto', limitarPorIp('foto-perfil', 20, 15), autenticar, recibirFoto, identidadController.cambiarFoto);
identidadRoutes.delete('/perfil/foto', autenticar, identidadController.quitarFoto);
identidadRoutes.get('/fotos/:nombre', identidadController.foto);
identidadRoutes.put(
  '/perfil/contrasena',
  limitarPorIp('cambiar-contrasena', 10, 15),
  autenticar,
  validarCuerpo(cambiarContrasenaSchema),
  identidadController.cambiarContrasena,
);
