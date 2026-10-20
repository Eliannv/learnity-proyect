export const environment = {
  /** URL base de la API REST. En desarrollo, proxy.conf.json la redirige a http://localhost:3000. */
  apiUrl: '/api',
  /**
   * Modo demostración: muestra en el login botones para entrar como Estudiante, Docente o Administrador
   * sin backend (sesión simulada, solo en memoria). Desactivado: el flujo normal usa la API real.
   * Actívalo únicamente para presentar pantallas sin backend.
   */
  modoDemo: false,
  /** Pantallas aún no implementadas de los sprints 3 y 4. */
  sprint34Habilitado: false,
};
