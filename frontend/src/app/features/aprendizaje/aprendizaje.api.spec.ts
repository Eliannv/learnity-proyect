import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AprendizajeApi, idApi } from './aprendizaje.api';

describe('AprendizajeApi', () => {
  let api: AprendizajeApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(AprendizajeApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('inscribe, consulta el temario privado y guarda el progreso por las rutas contratadas', async () => {
    const inscripcion = api.inscribir(17);
    const alta = http.expectOne('/api/cursos/17/inscripcion');
    expect(alta.request.method).toBe('POST');
    alta.flush({ id: 3, cursoId: 17, estado: 'ACTIVA', progresoPct: 0, ultimaLeccionId: null, inscritoEn: '2026-10-22T00:00:00Z', completadoEn: null }, { status: 201, statusText: 'Created' });
    expect((await inscripcion).cursoId).toBe(17);

    const lista = api.listar();
    const listaHttp = http.expectOne('/api/mi-aprendizaje');
    expect(listaHttp.request.method).toBe('GET');
    listaHttp.flush({ items: [] });
    expect((await lista).items).toEqual([]);

    const detalle = api.detalle(17);
    const detalleHttp = http.expectOne('/api/mi-aprendizaje/cursos/17');
    expect(detalleHttp.request.method).toBe('GET');
    detalleHttp.flush({ modulos: [] });
    expect((await detalle).modulos).toEqual([]);

    const progreso = api.guardarProgreso(25, { segundosVistos: 42, completada: true });
    const progresoHttp = http.expectOne('/api/lecciones/25/progreso');
    expect(progresoHttp.request.method).toBe('PUT');
    expect(progresoHttp.request.body).toEqual({ segundosVistos: 42, completada: true });
    progresoHttp.flush({ leccionId: 25, segundosVistos: 42, completada: true, progresoPct: 100, estado: 'COMPLETADA', ultimaLeccionId: 25 });
    expect((await progreso).progresoPct).toBe(100);
  });

  it('valida IDs decimales canónicos antes de usarlos como rutas', () => {
    expect(idApi('17')).toBe(17);
    expect(idApi('017')).toBeNull();
    expect(idApi('1e2')).toBeNull();
    expect(idApi(2_147_483_648)).toBeNull();
  });
});
