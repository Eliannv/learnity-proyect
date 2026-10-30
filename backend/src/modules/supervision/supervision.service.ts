import { identidadApi } from '../identidad/index.js';
import type { FiltroAccesosAdmin } from './supervision.esquemas.js';
import type { CuentaBloqueadaAdmin, PaginaAccesos } from './supervision.modelo.js';

// Capa service: supervisión del administrador. Los accesos y bloqueos pertenecen a Identidad y se leen por su API.

export const supervisionService = {
  async accesos(filtro: FiltroAccesosAdmin): Promise<PaginaAccesos> {
    const { items, total } = await identidadApi.listarAccesos({
      soloFallidos: filtro.resultado === 'fallidos',
      q: filtro.q || undefined,
      pagina: filtro.pagina,
      limite: filtro.limite,
    });
    return {
      items: items.map((e) => ({ ...e, fecha: e.fecha.toISOString() })),
      paginacion: { total, pagina: filtro.pagina, limite: filtro.limite, totalPaginas: Math.ceil(total / filtro.limite) },
    };
  },

  async cuentasBloqueadas(): Promise<{ items: CuentaBloqueadaAdmin[] }> {
    const cuentas = await identidadApi.cuentasBloqueadas();
    return { items: cuentas.map((c) => ({ ...c, bloqueadoHasta: c.bloqueadoHasta.toISOString() })) };
  },
};
