import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import type { ResumenAdmin } from '../../../../../core/api/contrato';
import { ICONOS } from '../../../../../shared/ui/marca/iconos';
import { ResumenApi } from '../../resumen.api';
import { AdminResumen } from './resumen';

const resumen: ResumenAdmin = {
  atencion: { solicitudesDocente: 2, cursosEnRevision: 0, reportesResenas: 1, alertasSeguridad: 4, alertasAltas: 1, cuentasBloqueadas: 0 },
  usuarios: { activos: 120, inactivos: 3, porRol: { ESTUDIANTE: 118, DOCENTE: 9, ADMIN: 2 } },
  cursos: { total: 30, porEstado: { BORRADOR: 5, EN_REVISION: 0, PUBLICADO: 22, RECHAZADO: 1, ARCHIVADO: 0, SUSPENDIDO: 2 } },
  inscripciones: { total: 200, activas: 150, completadas: 50 },
  resenas: { promedio: 4.3, total: 61 },
  generadoEn: '2026-10-30T15:00:00.000Z',
};

function montar(datos: ResumenAdmin = resumen) {
  const api = { obtener: vi.fn().mockResolvedValue(datos) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), { provide: ResumenApi, useValue: api },
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(AdminResumen);
  fixture.detectChanges();
  return { fixture, api };
}

async function cargado(fixture: ReturnType<typeof montar>['fixture']) {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.tarjeta-atencion').length).toBe(5);
  });
}

const tarjeta = (el: HTMLElement, titulo: string) =>
  [...el.querySelectorAll<HTMLAnchorElement>('.tarjeta-atencion')].find((a) => a.textContent?.includes(titulo))!;

describe('resumen del administrador', () => {
  it('muestra la atención rápida con enlaces y resalta solo los contadores con casos', async () => {
    const { fixture } = montar();
    await cargado(fixture);
    expect(fixture.nativeElement.textContent).toContain('7 casos esperan una acción');

    const solicitudes = tarjeta(fixture.nativeElement, 'Solicitudes de docente');
    expect(solicitudes.classList).toContain('con-casos');
    expect(solicitudes.getAttribute('href')).toBe('/admin/solicitudes');
    expect(solicitudes.getAttribute('aria-label')).toBe('Solicitudes de docente: 2 pendientes de decidir. Ir a Solicitudes de docente');

    const revision = tarjeta(fixture.nativeElement, 'Cursos por revisar');
    expect(revision.classList).not.toContain('con-casos');
    expect(revision.textContent).toContain('Al día');
    expect(revision.getAttribute('href')).toBe('/admin/revision');

    expect(tarjeta(fixture.nativeElement, 'Reportes de reseñas').getAttribute('href')).toBe('/admin/resenas?vista=PENDIENTE');
    const alertas = tarjeta(fixture.nativeElement, 'Alertas de seguridad');
    expect(alertas.classList).toContain('urgente');
    expect(alertas.textContent).toContain('1 de severidad alta');
    expect(alertas.getAttribute('href')).toBe('/admin/alertas');
    expect(tarjeta(fixture.nativeElement, 'Cuentas bloqueadas').getAttribute('href')).toBe('/admin/accesos');
  });

  it('muestra los indicadores globales con su desglose', async () => {
    const { fixture } = montar();
    await cargado(fixture);
    // Sin espacios: en el DOM de prueba los textos de <dt> y <dd> quedan pegados.
    const texto = (fixture.nativeElement.querySelector('.rejilla-indicadores').textContent as string).replace(/\s+/g, '');
    const contiene = (esperado: string) => expect(texto).toContain(esperado.replace(/\s+/g, ''));
    contiene('Usuarios activos 120');
    contiene('Estudiantes 118');
    contiene('Administradores 2');
    contiene('22 publicados');
    contiene('Suspendidos 2');
    contiene('Completadas 50 (25 %)');
    contiene('4.3 de 5 estrellas');
    contiene('Reseñas visibles 61');
    expect(texto).not.toContain('Archivados');
  });

  it('sin nada pendiente ni reseñas lo dice claramente', async () => {
    const { fixture } = montar({
      ...resumen, resenas: { promedio: null, total: 0 },
      atencion: { solicitudesDocente: 0, cursosEnRevision: 0, reportesResenas: 0, alertasSeguridad: 0, alertasAltas: 0, cuentasBloqueadas: 0 },
    });
    await cargado(fixture);
    expect(fixture.nativeElement.textContent).toContain('Nada pendiente');
    expect(fixture.nativeElement.querySelectorAll('.con-casos').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Sin reseñas');
  });
});
