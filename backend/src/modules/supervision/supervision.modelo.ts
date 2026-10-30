import type { MotivoAcceso, PasoAcceso } from '../identidad/index.js';

/** Respuestas del módulo Supervisión, tal como las recibe el cliente. */

export interface AccesoAdmin {
  id: number;
  fecha: string;
  usuario: { id: number; nombre: string } | null;
  /** El correo escrito al entrar o, si no se guardó (REFRESH), el de la cuenta. */
  correo: string | null;
  paso: PasoAcceso;
  exito: boolean;
  motivo: MotivoAcceso;
  agente: string | null;
}

export interface PaginaAccesos {
  items: AccesoAdmin[];
  paginacion: { total: number; pagina: number; limite: number; totalPaginas: number };
}

export interface CuentaBloqueadaAdmin {
  idUsuario: number;
  nombre: string;
  correo: string;
  intentosFallidos: number;
  bloqueadoHasta: string;
}
