/**
 * Error controlado del negocio. Los services lanzan AppError y el manejador global
 * lo convierte en una respuesta JSON con el código HTTP indicado.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly codigo = 'ERROR',
    public readonly detalles?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static solicitudInvalida(mensaje: string, detalles?: unknown) {
    return new AppError(400, mensaje, 'SOLICITUD_INVALIDA', detalles);
  }
  static noAutenticado(mensaje = 'Debes iniciar sesión.') {
    return new AppError(401, mensaje, 'NO_AUTENTICADO');
  }
  static sinPermiso(mensaje = 'No tienes permiso para realizar esta acción.') {
    return new AppError(403, mensaje, 'SIN_PERMISO');
  }
  static noEncontrado(mensaje = 'El recurso no existe.') {
    return new AppError(404, mensaje, 'NO_ENCONTRADO');
  }
  static conflicto(mensaje: string) {
    return new AppError(409, mensaje, 'CONFLICTO');
  }
  static pendiente(funcion: string) {
    return new AppError(501, `${funcion}: pendiente de implementar (Sprint 1).`, 'PENDIENTE');
  }
}
