import { HttpErrorResponse } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { CursoInscrito } from '../../../core/api/contrato';
import { AuthService } from '../../../core/auth/auth.service';
import { AprendizajeApi } from '../../../features/aprendizaje/aprendizaje.api';
import { cursoInscrito, detalleAprendizaje, diferido, sesionPrueba } from '../../../features/catalogo/pruebas/sprint3.fixtures';
import { ICONOS } from '../../../shared/ui/iconos';
import { MiAprendizaje } from './mi-aprendizaje';

describe('Mi aprendizaje Sprint 3', () => {
  function montar(items: CursoInscrito[] = []) {
    const api = { listar: vi.fn().mockResolvedValue({ items }), detalle: vi.fn((id: number) => Promise.resolve(detalleAprendizaje(id))) };
    const auth = sesionPrueba();
    TestBed.configureTestingModule({
      imports: [MiAprendizaje],
      providers: [provideRouter([]), importProvidersFrom(LucideAngularModule.pick(ICONOS)),
        { provide: AprendizajeApi, useValue: api }, { provide: AuthService, useValue: auth }],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MiAprendizaje);
    return { fixture, api, auth, navegar };
  }
  async function estable(fixture: ReturnType<typeof montar>['fixture']) {
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    await Promise.resolve(); fixture.detectChanges();
  }
  function boton(fixture: ReturnType<typeof montar>['fixture'], texto: string) {
    return [...fixture.nativeElement.querySelectorAll('button')].find(
      (boton) => (boton as HTMLButtonElement).textContent?.trim() === texto,
    ) as HTMLButtonElement;
  }

  it('muestra vacío desde la API y ofrece el catálogo', async () => {
    const { fixture, api } = montar();
    await estable(fixture);
    expect(api.listar).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Todavía no te has inscrito');
    expect(fixture.nativeElement.textContent).not.toContain('Introducción a Python');
    expect(fixture.nativeElement.querySelector('a[href="/cursos"]')).not.toBeNull();
  });

  it('muestra porcentaje, conteo y título de la última lección autorizada', async () => {
    const { fixture } = montar([cursoInscrito()]);
    await estable(fixture);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Última lección: Primera lección real');
    });
    expect(fixture.nativeElement.textContent).toContain('50% completado');
    expect(fixture.nativeElement.textContent).toContain('1/2 lecciones');
    expect(fixture.nativeElement.querySelector('progress')?.getAttribute('aria-label')).toContain('Seguridad de datos');
    expect(fixture.nativeElement.textContent).not.toContain('Mis evaluaciones');
  });

  it('continúa en la lección devuelta por una nueva consulta al servidor', async () => {
    const { fixture, api, navegar } = montar([cursoInscrito()]);
    await estable(fixture);
    const actualizado = detalleAprendizaje();
    actualizado.inscripcion.ultimaLeccionId = 82;
    api.detalle.mockResolvedValue(actualizado);
    boton(fixture, 'Continuar').click();
    await estable(fixture);
    expect(navegar).toHaveBeenCalledWith(['/aprender', 8, 82]);
  });

  it('vuelve a consultar la API al recrear la pantalla', async () => {
    const { fixture, api } = montar([cursoInscrito()]);
    await estable(fixture);
    fixture.destroy();
    const curso = cursoInscrito();
    curso.inscripcion.progresoPct = 100; curso.inscripcion.estado = 'COMPLETADA';
    curso.leccionesCompletadas = 2;
    api.listar.mockResolvedValue({ items: [curso] });
    const segunda = TestBed.createComponent(MiAprendizaje);
    await estable(segunda);
    expect(api.listar).toHaveBeenCalledTimes(2);
    expect(segunda.nativeElement.textContent).toContain('Completado');
  });

  it('pagina localmente y aplica la búsqueda al conjunto completo recibido', async () => {
    const cursos = Array.from({ length: 25 }, (_, i) => {
      const curso = cursoInscrito(i + 1); curso.inscripcion.ultimaLeccionId = null; return curso;
    });
    const { fixture, api } = montar(cursos);
    await estable(fixture);
    expect(fixture.nativeElement.querySelectorAll('.tarjeta-curso')).toHaveLength(12);
    boton(fixture, 'Siguiente').click();
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Página 2 de 3');
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'Seguridad de datos 25'; input.dispatchEvent(new Event('input'));
    await estable(fixture);
    expect(fixture.nativeElement.querySelectorAll('.tarjeta-curso')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Seguridad de datos 25');
    expect(api.listar).toHaveBeenCalledOnce();
  });

  it('un error permite reintentar y no muestra un vacío inventado', async () => {
    const { fixture, api } = montar();
    api.listar.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    await estable(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Todavía no te has inscrito');
    boton(fixture, 'Reintentar').click();
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Todavía no te has inscrito');
  });

  it('descarta cursos recibidos después de cerrar sesión', async () => {
    const { fixture, api, auth } = montar();
    const pendiente = diferido<{ items: CursoInscrito[] }>();
    api.listar.mockReturnValue(pendiente.promesa);
    fixture.detectChanges();
    auth.usuario.set(null); fixture.detectChanges();
    pendiente.resolver({ items: [cursoInscrito()] });
    await estable(fixture);
    expect(fixture.nativeElement.textContent).not.toContain('Seguridad de datos 8');
    expect(fixture.nativeElement.textContent).toContain('Inicia sesión');
  });

  it('no navega a una última lección que ya no pertenece al temario', async () => {
    const { fixture, api, navegar } = montar([cursoInscrito()]);
    const detalle = detalleAprendizaje();
    detalle.inscripcion.ultimaLeccionId = 999999;
    api.detalle.mockResolvedValue(detalle);
    await estable(fixture);
    boton(fixture, 'Continuar').click();
    await estable(fixture);
    expect(navegar).toHaveBeenCalledWith(['/aprender', 8, 82]);
  });
});
