import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CatalogoApi, type CursoPublico, type DetalleCursoPublico } from './catalogo.api';

const publicado: CursoPublico = {
  id: 1,
  titulo: 'Python',
  subtitulo: null,
  categoria: { id: 2, nombre: 'Programación' },
  docente: 'Carlos Mendoza',
  nivel: 'PRINCIPIANTE',
  portadaUrl: null,
  modulos: 1,
  lecciones: 1,
  minutos: 4,
  publicadoEn: '2026-10-09T15:00:00.000Z',
  estado: 'PUBLICADO',
};

describe('CatalogoApi', () => {
  let servicio: CatalogoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(CatalogoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía búsqueda, filtros repetidos, orden y paginación a la API', async () => {
    const promesa = servicio.catalogo({
      q: ' python ',
      categorias: ['Programación', 'Diseño'],
      niveles: ['PRINCIPIANTE'],
      orden: 'az',
      pagina: 2,
      limite: 9,
    });
    const peticion = http.expectOne((r) => r.url === '/api/cursos');
    expect(peticion.request.params.get('q')).toBe('python');
    expect(peticion.request.params.getAll('categoria')).toEqual(['Programación', 'Diseño']);
    expect(peticion.request.params.getAll('nivel')).toEqual(['PRINCIPIANTE']);
    expect(peticion.request.params.get('orden')).toBe('az');
    expect(peticion.request.params.get('pagina')).toBe('2');
    peticion.flush({ items: [publicado], pagina: 2, limite: 9, total: 10, totalPaginas: 2 });
    expect((await promesa).items).toEqual([publicado]);
  });

  it('no expone borradores aunque el servidor los incluya por error', async () => {
    const promesa = servicio.catalogo({ orden: 'recientes', pagina: 1, limite: 9 });
    const borrador = { ...publicado, id: 2, estado: 'BORRADOR' };
    http.expectOne((r) => r.url === '/api/cursos').flush({
      items: [borrador, publicado],
      pagina: 1,
      limite: 9,
      total: 2,
      totalPaginas: 1,
    });
    expect((await promesa).items).toEqual([publicado]);
  });

  it('acepta catálogo vacío y oculta el detalle no publicado', async () => {
    const vacio = servicio.catalogo({ orden: 'recientes', pagina: 1, limite: 9 });
    http
      .expectOne((r) => r.url === '/api/cursos')
      .flush({ items: [], pagina: 1, limite: 9, total: 0, totalPaginas: 0 });
    expect((await vacio).items).toEqual([]);

    const detalle = servicio.detalle('2');
    http
      .expectOne('/api/cursos/2')
      .flush({ ...publicado, estado: 'EN_REVISION', temario: [] } as unknown as DetalleCursoPublico);
    expect(await detalle).toBeNull();
  });

  it('solicita una muestra de video solo por ID de lección válido', async () => {
    const muestra = servicio.videoVistaPrevia(17);
    http.expectOne('/api/lecciones/17/video-preview').flush({
      leccionId: 17, youtubeVideoId: 'dQw4w9WgXcQ',
    });
    expect((await muestra).youtubeVideoId).toBe('dQw4w9WgXcQ');
    await expect(servicio.videoVistaPrevia(-1)).rejects.toThrow();
    http.expectNone('/api/lecciones/-1/video-preview');
  });
});
