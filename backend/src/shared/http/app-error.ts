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
  static noAutenticado(mensaje = 'Debes iniciar sesión.', codigo = 'NO_AUTENTICADO') {
    return new AppError(401, mensaje, codigo);
  }
  static sinPermiso(mensaje = 'No tienes permiso para realizar esta acción.', codigo = 'SIN_PERMISO') {
    return new AppError(403, mensaje, codigo);
  }
  static noEncontrado(mensaje = 'El recurso no existe.') {
    return new AppError(404, mensaje, 'NO_ENCONTRADO');
  }
  static conflicto(mensaje: string, codigo = 'CONFLICTO') {
    return new AppError(409, mensaje, codigo);
  }
  static demasiadasPeticiones(segundos: number) {
    return new AppError(429, 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', 'DEMASIADAS_PETICIONES', {
      reintentarEnSegundos: segundos,
    });
  }
  /** Para las rutas de sprints futuros que todavía no están implementadas. */
  static pendiente(funcion: string) {
    return new AppError(501, `${funcion}: pendiente de implementar.`, 'PENDIENTE');
  }
}
