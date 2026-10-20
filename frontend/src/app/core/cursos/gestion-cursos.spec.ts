import {
  HttpEventType,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { authInterceptor } from '../auth/auth.interceptor';

import { CursoDetalle } from './gestion-cursos.model';

import { ContenidoApi } from '../../features/contenido/contenido.api';
import { PdfLeccion } from '../../features/contenido/componentes/pdf-leccion';
import { DocenteCursosApi } from '../../features/docente-cursos/docente-cursos.api';
import { ArbolTemario } from '../../features/docente-cursos/componentes/arbol-temario';
import { EditorCurso } from '../../features/docente-cursos/paginas/editor-curso/editor-curso';
import { MisCursosDocente } from '../../features/docente-cursos/paginas/mis-cursos/mis-cursos';
import { RevisionCurso } from '../../features/revision/paginas/revision-curso/revision-curso';
import { RevisionCursos } from '../../features/revision/paginas/revision-cursos/revision-cursos';

// Datos utilizados exclusivamente por las pruebas.
function curso(
  estado: CursoDetalle['estado'] = 'BORRADOR',
): CursoDetalle {
  return {
    id: 41,
    titulo: 'Mi curso',
    subtitulo: 'Curso de prueba',
    descripcion: 'Contenido del curso',
    categoriaId: 2,
    categoriaNombre: 'Programación',
    nivel: 'PRINCIPIANTE',
    portadaUrl: '/img/hero-estudiante.jpg',
    objetivos: ['Uno', 'Dos', 'Tres'],
    requisitos: [],
    estado,
    motivoRechazo: null,
    docente: 'Docente de prueba',
    modulos: [
      {
        id: 5,
        titulo: 'Introducción',
        orden: 1,
        lecciones: [
          {
            id: 9,
            titulo: 'Lectura',
            orden: 1,
            tipo: 'DOCUMENTO',
            archivo: {
              id: 12,
              tipo: 'PDF',
              nombreOriginal: 'clase.pdf',
              tamanoBytes: 100,
            },
          },
        ],
      },
    ],
    validacion: {
      completo: true,
      problemas: [],
    },
  };
}

// Espera los cambios asíncronos y actualiza la vista.
async function actualizar<T>(
  fixture: ComponentFixture<T>,
): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

// Busca un botón por su texto visible.
function boton<T>(
  fixture: ComponentFixture<T>,
  texto: string,
): HTMLButtonElement {
  const botones = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
  );

  const encontrado = botones.find(
    (elemento) => elemento.textContent?.includes(texto),
  );

  if (!encontrado) {
    throw new Error(`No existe el botón ${texto}`);
  }

  return encontrado;
}

describe('Flujo docente y ADMIN: API y pantallas', () => {
  let http: HttpTestingController;
  let api: ContenidoApi;
  let docenteApi: DocenteCursosApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),

        provideHttpClient(
          withInterceptors([authInterceptor]),
        ),

        provideHttpClientTesting(),

        {
          provide: AuthService,
          useValue: {
            token: () => 'token-de-prueba',
            esDemo: () => false,
            autenticado: () => true,
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ContenidoApi);
    docenteApi = TestBed.inject(DocenteCursosApi);
  });

  afterEach(() => {
    http.verify();
  });

  it('descarga el PDF privado con Bearer y respuesta binaria', async () => {
    const promesa = api.descargarPdf(12);
    const solicitud = http.expectOne('/api/archivos/12');

    expect(
      solicitud.request.headers.get('Authorization'),
    ).toBe('Bearer token-de-prueba');

    expect(solicitud.request.responseType).toBe('blob');

    const pdf = new Blob(
      ['%PDF-1.4\n'],
      { type: 'application/pdf' },
    );

    solicitud.flush(pdf);

    expect(await promesa).toBe(pdf);
  });

  it('muestra un error y reintenta la lista sin inventar cursos', async () => {
    const f = TestBed.createComponent(MisCursosDocente);
    f.detectChanges();

    http.expectOne('/api/docente/cursos').flush(
      { error: { mensaje: 'No disponible' } },
      { status: 503, statusText: 'Unavailable' },
    );

    await actualizar(f);

    expect(f.nativeElement.textContent).toContain('No disponible');
    expect(f.nativeElement.querySelectorAll('li').length).toBe(0);

    boton(f, 'Reintentar').click();

    http.expectOne('/api/docente/cursos').flush({ items: [] });

    await actualizar(f);

    expect(f.nativeElement.textContent).toContain('No tienes cursos');
  });

  it('la cola pide solo EN_REVISION y enlaza el ID real', async () => {
    const f = TestBed.createComponent(RevisionCursos);
    f.detectChanges();

    http.expectOne(
      '/api/admin/cursos?estado=EN_REVISION',
    ).flush({
      items: [
        {
          id: 41,
          titulo: 'Mi curso',
          docente: 'Autora',
          estado: 'EN_REVISION',
          modulos: 1,
          motivoRechazo: null,
        },
      ],
    });

    await actualizar(f);

    expect(
      f.nativeElement.querySelector('li a').getAttribute('href'),
    ).toBe('/admin/revision/41');
  });

  // Prepara el editor con un curso o con un error de permisos.
  async function editor(
    respuesta: CursoDetalle | null,
    id = '41',
  ): Promise<ComponentFixture<EditorCurso>> {
    const f = TestBed.createComponent(EditorCurso);

    f.componentRef.setInput('id', id);
    f.detectChanges();

    http.expectOne('/api/categorias').flush([
      { id: 2, nombre: 'Programación' },
    ]);

    if (id !== 'nuevo') {
      const solicitud = http.expectOne(
        `/api/docente/cursos/${id}`,
      );

      if (respuesta) {
        solicitud.flush(respuesta);
      } else {
        solicitud.flush(
          { error: { mensaje: 'No tienes permiso' } },
          { status: 403, statusText: 'Forbidden' },
        );
      }
    }

    await actualizar(f);

    return f;
  }

  it('un borrador ajeno devuelve 403 y no muestra formulario ni temario', async () => {
    const f = await editor(null);

    expect(f.nativeElement.textContent).toContain('No tienes permiso');
    expect(f.nativeElement.querySelector('form')).toBeNull();

    expect(
      f.nativeElement.querySelector('app-arbol-temario'),
    ).toBeNull();
  });

  it('un curso en revisión es de solo lectura', async () => {
    const f = await editor(curso('EN_REVISION'));

    expect(
      f.nativeElement
        .querySelector('input[formControlName="titulo"]')
        .matches(':disabled'),
    ).toBe(true);

    expect(f.nativeElement.textContent).not.toContain('Agregar módulo');
    expect(f.nativeElement.textContent).not.toContain('Enviar a revisión');
  });

  it('envía a revisión solo al confirmar la API y conserva BORRADOR si falla', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const f = await editor(curso());

    boton(f, 'Enviar a revisión').click();
    f.detectChanges();

    expect(
      f.nativeElement.querySelector('app-estado-curso').textContent,
    ).toContain('Borrador');

    http.expectOne('/api/cursos/41/enviar-revision').flush(
      { error: { mensaje: 'El PDF dejó de ser válido' } },
      { status: 409, statusText: 'Conflict' },
    );

    await actualizar(f);

    expect(
      f.nativeElement.querySelector('app-estado-curso').textContent,
    ).toContain('Borrador');

    expect(f.nativeElement.textContent).toContain(
      'El PDF dejó de ser válido',
    );

    expect(boton(f, 'Enviar a revisión').disabled).toBe(true);

    boton(f, 'Actualizar curso').click();

    http.expectOne('/api/categorias').flush([
      { id: 2, nombre: 'Programación' },
    ]);

    http.expectOne('/api/docente/cursos/41').flush(curso());

    await actualizar(f);

    boton(f, 'Enviar a revisión').click();

    http.expectOne('/api/cursos/41/enviar-revision').flush(
      curso('EN_REVISION'),
    );

    await actualizar(f);

    expect(
      f.nativeElement.querySelector('app-estado-curso').textContent,
    ).toContain('En revisión');

    expect(
      f.nativeElement
        .querySelector('input[formControlName="titulo"]')
        .matches(':disabled'),
    ).toBe(true);
  });

  it('crea con POST y muestra el error del servidor junto al campo', async () => {
    const f = await editor(null, 'nuevo');

    const titulo = f.nativeElement.querySelector(
      'input[formControlName="titulo"]',
    ) as HTMLInputElement;

    titulo.value = 'Nuevo curso';
    titulo.dispatchEvent(new Event('input', { bubbles: true }));

    const select = f.nativeElement.querySelector(
      'select[formControlName="categoriaId"]',
    ) as HTMLSelectElement;

    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await actualizar(f);

    boton(f, 'Crear borrador').click();

    const solicitud = http.expectOne('/api/cursos');

    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body.categoriaId).toBe(2);
    expect(solicitud.request.body.idDocente).toBeUndefined();

    solicitud.flush(
      {
        error: {
          mensaje: 'Revisa los datos',
          detalles: [
            {
              campo: 'titulo',
              mensaje: 'El título no es válido',
            },
          ],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    await actualizar(f);

    expect(titulo.parentElement?.textContent).toContain(
      'El título no es válido',
    );

    expect(
      f.nativeElement.querySelector('app-arbol-temario'),
    ).toBeNull();

    const navegar = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    boton(f, 'Crear borrador').click();

    http.expectOne('/api/cursos').flush(curso());

    await actualizar(f);

    expect(navegar).toHaveBeenCalledWith(
      ['/docente/cursos', 41, 'editar'],
      { replaceUrl: true },
    );
  });

  // Simula que una persona selecciona un archivo.
  function seleccionarPdf(
    f: ComponentFixture<PdfLeccion>,
    archivo: File,
  ): void {
    const input = f.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [archivo],
    });

    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function configurarPdfLeccion(f: ComponentFixture<PdfLeccion>): void {
    f.componentRef.setInput('subirArchivo', (id: number, arch: File) =>
      api.subirPdf(id, arch),
    );
    f.componentRef.setInput('descargarArchivo', (id: number) =>
      api.descargarPdf(id),
    );
  }

  it('sube multipart con progreso y espera la respuesta antes de asociar el PDF', async () => {
    const f = TestBed.createComponent(PdfLeccion);
    configurarPdfLeccion(f);

    f.componentRef.setInput('leccion', {
      ...curso().modulos[0].lecciones[0],
      archivo: null,
    });

    f.componentRef.setInput('editable', true);

    const recibir = vi.fn();
    f.componentInstance.actualizado.subscribe(recibir);

    f.detectChanges();

    seleccionarPdf(
      f,
      new File(
        ['%PDF-1.4\n'],
        'clase.pdf',
        { type: 'application/pdf' },
      ),
    );

    const solicitud = http.expectOne('/api/lecciones/9/archivo');

    expect(solicitud.request.body instanceof FormData).toBe(true);

    expect(
      solicitud.request.body.get('archivo').name,
    ).toBe('clase.pdf');

    expect(
      solicitud.request.headers.has('Content-Type'),
    ).toBe(false);

    solicitud.event({
      type: HttpEventType.UploadProgress,
      loaded: 50,
      total: 100,
    });

    f.detectChanges();

    expect(
      f.nativeElement.querySelector('progress').value,
    ).toBe(50);

    expect(recibir).not.toHaveBeenCalled();

    solicitud.flush(curso());

    await actualizar(f);

    expect(recibir).toHaveBeenCalledWith(curso());

    expect(f.nativeElement.textContent).toContain(
      'PDF guardado y asociado',
    );
  });

  it('un fallo de subida conserva el archivo anterior y no confirma una asociación', async () => {
    const f = TestBed.createComponent(PdfLeccion);
    configurarPdfLeccion(f);

    f.componentRef.setInput(
      'leccion',
      curso().modulos[0].lecciones[0],
    );

    f.componentRef.setInput('editable', true);

    const recibir = vi.fn();
    f.componentInstance.actualizado.subscribe(recibir);

    f.detectChanges();

    seleccionarPdf(
      f,
      new File(
        ['%PDF-1.4\n'],
        'reemplazo.pdf',
        { type: 'application/pdf' },
      ),
    );

    http.expectOne('/api/lecciones/9/archivo').flush(
      { error: { mensaje: 'No se pudo guardar el PDF' } },
      { status: 500, statusText: 'Error' },
    );

    await actualizar(f);

    expect(recibir).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('clase.pdf');

    expect(f.nativeElement.textContent).toContain(
      'No se pudo guardar el PDF',
    );
  });

  it('rechaza PDF de más de 10 MB antes de enviarlo', async () => {
    const f = TestBed.createComponent(PdfLeccion);
    configurarPdfLeccion(f);

    f.componentRef.setInput(
      'leccion',
      curso().modulos[0].lecciones[0],
    );

    f.componentRef.setInput('editable', true);
    f.detectChanges();

    seleccionarPdf(
      f,
      new File(
        [new Uint8Array(10 * 1024 * 1024 + 1)],
        'grande.pdf',
      ),
    );

    await actualizar(f);

    http.expectNone('/api/lecciones/9/archivo');
    expect(f.nativeElement.textContent).toContain('10 MB');
  });

  it('no agrega un módulo si el servidor rechaza el orden duplicado', async () => {
    const f = TestBed.createComponent(ArbolTemario);

    f.componentRef.setInput('curso', curso());
    f.componentRef.setInput('editable', true);
    f.componentRef.setInput(
      'guardarModuloFn',
      (cursoId: number, id: number | null, datos: { titulo: string; orden: number }) =>
        docenteApi.guardarModulo(cursoId, id, datos),
    );
    f.componentRef.setInput('subirArchivoFn', (id: number, arch: File) =>
      api.subirPdf(id, arch),
    );
    f.componentRef.setInput('descargarArchivoFn', (id: number) =>
      api.descargarPdf(id),
    );

    const recibir = vi.fn();
    f.componentInstance.actualizado.subscribe(recibir);

    f.detectChanges();

    boton(f, 'Agregar módulo').click();

    await actualizar(f);

    const titulo = f.nativeElement.querySelector(
      'input[name="titulo"]',
    ) as HTMLInputElement;

    titulo.value = 'Otro módulo';
    titulo.dispatchEvent(new Event('input', { bubbles: true }));

    await actualizar(f);

    boton(f, 'Guardar módulo').click();

    const solicitud = http.expectOne('/api/cursos/41/modulos');

    expect(solicitud.request.body.orden).toBe(2);

    solicitud.flush(
      {
        error: {
          mensaje: 'Revisa el orden',
          detalles: [
            {
              campo: 'orden',
              mensaje: 'Ese orden ya existe',
            },
          ],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    await actualizar(f);

    expect(recibir).not.toHaveBeenCalled();

    expect(
      f.nativeElement
        .querySelector('input[name="orden"]')
        .parentElement.textContent,
    ).toContain('Ese orden ya existe');
  });

  // Prepara la pantalla de revisión del administrador.
  async function revision(): Promise<ComponentFixture<RevisionCurso>> {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const f = TestBed.createComponent(RevisionCurso);

    f.componentRef.setInput('id', '41');
    f.detectChanges();

    http.expectOne('/api/admin/cursos/41').flush(
      curso('EN_REVISION'),
    );

    await actualizar(f);

    return f;
  }

  it('ADMIN no puede rechazar sin motivo', async () => {
    const f = await revision();

    boton(f, 'Rechazar con motivo').click();

    await actualizar(f);

    http.expectNone('/api/admin/cursos/41/revision');

    expect(f.nativeElement.textContent).toContain(
      'Escribe el motivo',
    );
  });

  it('un 409 de otra decisión no muestra una aprobación ficticia', async () => {
    const f = await revision();

    boton(f, 'Aprobar y publicar').click();
    f.detectChanges();

    expect(
      f.nativeElement.querySelector('app-estado-curso').textContent,
    ).toContain('En revisión');

    const solicitud = http.expectOne(
      '/api/admin/cursos/41/revision',
    );

    expect(solicitud.request.body).toEqual({
      decision: 'APROBAR',
    });

    solicitud.flush(
      {
        error: {
          mensaje: 'Otro administrador ya decidió este curso',
        },
      },
      { status: 409, statusText: 'Conflict' },
    );

    await actualizar(f);

    expect(f.nativeElement.textContent).toContain(
      'Otro administrador ya decidió',
    );

    expect(f.nativeElement.textContent).not.toContain(
      'Curso publicado.',
    );

    expect(f.nativeElement.textContent).not.toContain(
      'Aprobar y publicar',
    );
  });

  it('confirma el rechazo con el motivo devuelto por el servidor', async () => {
    const f = await revision();

    const textarea = f.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    textarea.value = 'Explica mejor los objetivos';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    await actualizar(f);

    boton(f, 'Rechazar con motivo').click();

    const solicitud = http.expectOne(
      '/api/admin/cursos/41/revision',
    );

    expect(solicitud.request.body).toEqual({
      decision: 'RECHAZAR',
      motivo: 'Explica mejor los objetivos',
    });

    solicitud.flush({
      ...curso('RECHAZADO'),
      motivoRechazo: 'Explica mejor los objetivos',
    });

    await actualizar(f);

    expect(
      f.nativeElement.querySelector('app-estado-curso').textContent,
    ).toContain('Rechazado');

    expect(f.nativeElement.textContent).toContain(
      'Explica mejor los objetivos',
    );
  });
});
