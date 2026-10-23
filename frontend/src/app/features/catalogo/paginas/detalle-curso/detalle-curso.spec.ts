import { HttpErrorResponse } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ICONOS } from '../../../../shared/ui/iconos';
import { CatalogoApi } from '../../catalogo.api';
import { AprendizajeApi } from '../../../aprendizaje/aprendizaje.api';
import { AuthService } from '../../../../core/auth/auth.service';
import type { InscripcionAprendizaje, VistaPreviaVideo } from '../../../../core/api/contrato';
import { cursoPublico, detalleAprendizaje, diferido, sesionPrueba } from '../../pruebas/sprint3.fixtures';
import { DetalleCurso } from './detalle-curso';

describe('Detalle público e inscripción Sprint 3', () => {
  function montar(auth = sesionPrueba(), yaInscrito = false) {
    vi.spyOn(auth, 'sesionExpirada');
    const api = {
      detalle: vi.fn((id: string) => Promise.resolve(cursoPublico(Number(id)))),
      videoVistaPrevia: vi.fn(),
    };
    const aprendizaje = {
      detalle: vi.fn((id: number) => yaInscrito ? Promise.resolve(detalleAprendizaje(id))
        : Promise.reject(new HttpErrorResponse({ status: 404 }))),
      inscribir: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [DetalleCurso],
      providers: [provideRouter([]), importProvidersFrom(LucideAngularModule.pick(ICONOS)),
        { provide: CatalogoApi, useValue: api }, { provide: AprendizajeApi, useValue: aprendizaje },
        { provide: AuthService, useValue: auth }],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DetalleCurso);
    fixture.componentRef.setInput('id', '8');
    return { fixture, api, aprendizaje, auth, navegar };
  }
  async function estable(fixture: ReturnType<typeof montar>['fixture']) {
    for (let paso = 0; paso < 3; paso++) {
      fixture.detectChanges(); await fixture.whenStable();
    }
    fixture.detectChanges();
  }
  function botones(fixture: ReturnType<typeof montar>['fixture'], texto: string): HTMLButtonElement[] {
    return [...fixture.nativeElement.querySelectorAll('button')].filter(
      (boton) => (boton as HTMLButtonElement).textContent?.trim() === texto,
    ) as HTMLButtonElement[];
  }

  it('muestra 404 sin recurrir a datos demo', async () => {
    const { fixture, api } = montar(sesionPrueba(null));
    api.detalle.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Curso no disponible');
    expect(fixture.nativeElement.textContent).not.toContain('Introducción a Python');
  });

  it('lleva al login conservando el curso y no consulta inscripciones del visitante', async () => {
    const { fixture, navegar, aprendizaje } = montar(sesionPrueba(null));
    await estable(fixture);
    botones(fixture, 'Inicia sesión para inscribirte')[0]!.click();
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { volver: '/cursos/8' } });
    expect(aprendizaje.detalle).not.toHaveBeenCalled();
    expect(aprendizaje.inscribir).not.toHaveBeenCalled();
  });

  it('reconoce al inscrito y ofrece la lección autorizada sin repetir el POST', async () => {
    const { fixture, aprendizaje } = montar(sesionPrueba(), true);
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Ya estás inscrito');
    expect(fixture.nativeElement.querySelector('a[href="/aprender/8/81"]')).not.toBeNull();
    expect(aprendizaje.inscribir).not.toHaveBeenCalled();
  });

  it('evita dos envíos aunque se pulsen las tarjetas móvil y escritorio', async () => {
    const { fixture, aprendizaje } = montar();
    const pendiente = diferido<InscripcionAprendizaje>();
    aprendizaje.inscribir.mockReturnValue(pendiente.promesa);
    await estable(fixture);
    const acciones = botones(fixture, 'Inscribirme gratis');
    acciones[0]!.click(); acciones[1]!.click();
    expect(aprendizaje.inscribir).toHaveBeenCalledOnce();
    aprendizaje.detalle.mockResolvedValue(detalleAprendizaje());
    pendiente.resolver(detalleAprendizaje().inscripcion);
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Tu inscripción está confirmada');
    expect(fixture.nativeElement.querySelector('a[href="/aprender/8/81"]')).not.toBeNull();
  });

  it('un fallo no confirma éxito ni navega y primero permite comprobar de nuevo', async () => {
    const { fixture, aprendizaje, navegar } = montar();
    aprendizaje.inscribir.mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    await estable(fixture);
    botones(fixture, 'Inscribirme gratis')[0]!.click();
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Comprueba tu conexión');
    expect(fixture.nativeElement.textContent).not.toContain('Tu inscripción está confirmada');
    expect(botones(fixture, 'Comprobar inscripción').length).toBe(2);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('ignora una inscripción pendiente cuando se cierra la sesión', async () => {
    const { fixture, aprendizaje, auth, navegar } = montar();
    const pendiente = diferido<InscripcionAprendizaje>();
    aprendizaje.inscribir.mockReturnValue(pendiente.promesa);
    await estable(fixture);
    botones(fixture, 'Inscribirme gratis')[0]!.click();
    auth.usuario.set(null); fixture.detectChanges();
    pendiente.resolver(detalleAprendizaje().inscripcion);
    await estable(fixture);
    expect(fixture.nativeElement.textContent).toContain('Inicia sesión para inscribirte');
    expect(fixture.nativeElement.textContent).not.toContain('Tu inscripción está confirmada');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('bloquea la inscripción con un rol incorrecto', async () => {
    const { fixture, aprendizaje } = montar(sesionPrueba(['ADMIN']));
    await estable(fixture);
    expect(botones(fixture, 'Necesitas el rol de estudiante')[0]!.disabled).toBe(true);
    expect(aprendizaje.detalle).not.toHaveBeenCalled();
    expect(aprendizaje.inscribir).not.toHaveBeenCalled();
  });

  it('solicita iniciar sesión cuando la comprobación devuelve 401', async () => {
    const { fixture, aprendizaje, auth } = montar();
    aprendizaje.detalle.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    await estable(fixture);
    expect(auth.sesionExpirada).toHaveBeenCalledOnce();
    expect(aprendizaje.inscribir).not.toHaveBeenCalled();
  });

  it('la última muestra solicitada prevalece aunque las respuestas lleguen al revés', async () => {
    const { fixture, api } = montar(sesionPrueba(null));
    const primera = diferido<VistaPreviaVideo>();
    const segunda = diferido<VistaPreviaVideo>();
    api.videoVistaPrevia.mockReturnValueOnce(primera.promesa).mockReturnValueOnce(segunda.promesa);
    await estable(fixture);
    const acciones = botones(fixture, 'Consultar muestra');
    acciones[0]!.click(); acciones[1]!.click();
    segunda.resolver({ leccionId: 82, youtubeVideoId: 'dQw4w9WgXcQ' });
    await estable(fixture);
    primera.resolver({ leccionId: 81, youtubeVideoId: 'M7lc1UVf-VE' });
    await estable(fixture);
    expect(fixture.nativeElement.querySelector('.muestra-panel')?.textContent).toContain('Segunda lección real');
    expect(fixture.nativeElement.querySelector('.muestra-panel')?.textContent).not.toContain('Primera lección real');
  });

  it('un iframe recibido en lugar de un ID jamás se presenta al reproductor', async () => {
    const { fixture, api } = montar(sesionPrueba(null));
    api.videoVistaPrevia.mockResolvedValue({ leccionId: 81, youtubeVideoId: '<iframe src="https://falso.test">' });
    await estable(fixture);
    botones(fixture, 'Consultar muestra')[0]!.click();
    await estable(fixture);
    expect(fixture.nativeElement.querySelector('app-reproductor-youtube')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar la muestra');
  });
});
