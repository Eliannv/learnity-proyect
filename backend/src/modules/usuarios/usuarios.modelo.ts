import type { ESTADOS_SOLICITUD } from './usuarios.esquemas.js';

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export interface SolicitudDocente {
  id: number;
  estado: EstadoSolicitud;
  especialidad: string;
  motivo: string;
  observacion: string | null;
  enviadaEn: string;
  revisadaEn: string | null;
  solicitante: {
    nombres: string;
    apellidos: string;
    correo: string;
    estudianteDesde: string;
    cursosCompletados: number;
  };
}
