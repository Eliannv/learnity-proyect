import type { Correo } from './correo.js';

/** Estrategia de envío de correo (ADR-005, 5.1). Cada valor de CORREO_TRANSPORTE tiene la suya. */
export interface TransporteCorreo {
  enviar(correo: Correo): Promise<void>;
}
