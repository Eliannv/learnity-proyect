export const environment = {
  /** URL base de la API REST. En desarrollo, proxy.conf.json la redirige a http://localhost:3000. */
  apiUrl: '/api',
  /**
   * Modo demostración: muestra en el login botones para entrar como Estudiante, Docente o Administrador
   * sin backend. Sirve para presentar las pantallas mientras se implementa el Sprint 1.
   * Ponlo en false cuando el inicio de sesión real esté listo.
   */
  modoDemo: true,
};
