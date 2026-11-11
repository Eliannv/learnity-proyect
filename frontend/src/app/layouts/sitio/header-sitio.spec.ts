import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../shared/ui/marca/iconos';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogoApi, type PaginaCursos } from '../../features/catalogo/catalogo.api';
import { HeaderSitio } from './header-sitio';

@Component({ template: '' })
class VistaPrueba {}

describe('HeaderSitio - Buscador móvil estilo YouTube', () => {
  const vacia: PaginaCursos = { items: [], pagina: 1, limite: 5, total: 0, totalPaginas: 0 };

  const montar = (autenticado = false, categoriasMock: Array<{ id: number; nombre: string; icono: string }> = []) => {
    const authMock = {
      autenticado: signal(autenticado),
      esDocente: signal(false),
      esAdmin: signal(false),
      roles: signal(autenticado ? ['ESTUDIANTE'] : []),
      usuario: signal(autenticado ? { nombres: 'Ana', apellidos: 'Gómez', correo: 'ana@example.com' } : null),
      iniciales: signal('AG'),
      nombreCompleto: signal('Ana Gómez'),
      rutaPerfil: signal('/perfil'),
      cerrarSesion: () => {},
    };

    const catalogoApiMock = {
      categorias: vi.fn().mockResolvedValue(categoriasMock),
      listar: vi.fn().mockResolvedValue(vacia),
    };

    TestBed.configureTestingModule({
      imports: [HeaderSitio],
      providers: [
        provideRouter([
          { path: 'cursos', component: VistaPrueba },
          { path: 'cursos/:id', component: VistaPrueba },
          { path: '**', component: VistaPrueba },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authMock },
        { provide: CatalogoApi, useValue: catalogoApiMock },
        { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
      ],
    });

    const fixture = TestBed.createComponent(HeaderSitio);
    fixture.detectChanges();
    return { fixture, authMock, catalogoApiMock };
  };

  it('visitante: muestra botón de lupa en móvil; al pulsarlo abre la barra de búsqueda y el botón atrás la cierra', () => {
    const { fixture } = montar(false);
    const el = fixture.nativeElement as HTMLElement;

    // Botón de lupa visible para visitantes en móvil
    const btnLupa = el.querySelector('.btn-lupa-movil') as HTMLButtonElement;
    expect(btnLupa).not.toBeNull();

    // Inicialmente no está abierta la barra de búsqueda móvil
    expect(el.querySelector('.barra-busqueda-movil')).toBeNull();

    // Al hacer clic en la lupa, se abre la barra móvil estilo YouTube
    btnLupa.click();
    fixture.detectChanges();

    const barraBusqueda = el.querySelector('.barra-busqueda-movil');
    expect(barraBusqueda).not.toBeNull();
    expect(el.querySelector('.telon-busqueda-movil')).not.toBeNull();

    // Contiene el botón de volver atrás y el buscador de cursos
    const btnAtras = barraBusqueda?.querySelector('.btn-volver-busqueda') as HTMLButtonElement;
    expect(btnAtras).not.toBeNull();
    expect(barraBusqueda?.querySelector('app-buscador-curso')).not.toBeNull();

    // Al pulsar el botón atrás, se cierra la búsqueda
    btnAtras.click();
    fixture.detectChanges();

    expect(el.querySelector('.barra-busqueda-movil')).toBeNull();
    expect(el.querySelector('.telon-busqueda-movil')).toBeNull();
  });

  it('sesión iniciada: también muestra el botón de lupa y se puede cerrar con el telón o tecla Escape', () => {
    const { fixture } = montar(true);
    const el = fixture.nativeElement as HTMLElement;

    const btnLupa = el.querySelector('.btn-lupa-movil') as HTMLButtonElement;
    expect(btnLupa).not.toBeNull();

    // Abrir búsqueda móvil
    btnLupa.click();
    fixture.detectChanges();
    expect(el.querySelector('.barra-busqueda-movil')).not.toBeNull();

    // Cerrar al pulsar el telón de fondo
    const telon = el.querySelector('.telon-busqueda-movil') as HTMLElement;
    telon.click();
    fixture.detectChanges();
    expect(el.querySelector('.barra-busqueda-movil')).toBeNull();

    // Volver a abrir y cerrar con Escape
    btnLupa.click();
    fixture.detectChanges();
    expect(el.querySelector('.barra-busqueda-movil')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.barra-busqueda-movil')).toBeNull();
  });

  it('estudiante autenticado: al pulsar «Enseña en Learnity» abre el modal directamente sin redirigir a /perfil', () => {
    const { fixture } = montar(true);
    const el = fixture.nativeElement as HTMLElement;

    const btnEnsenar = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Enseña en Learnity'),
    ) as HTMLButtonElement;
    expect(btnEnsenar).toBeTruthy();

    btnEnsenar.click();
    fixture.detectChanges();

    const dialogo = el.querySelector('[role="dialog"]');
    expect(dialogo).not.toBeNull();
    expect(dialogo?.textContent).toContain('Solicitud para ser docente');
  });

  it('barra de categorías del navbar tiene clase oculto-movil y limita al top 6 de categorías con más cursos', async () => {
    const ocho = [
      { id: 1, nombre: 'Programación', icono: 'code' },
      { id: 2, nombre: 'Diseño', icono: 'pen-tool' },
      { id: 3, nombre: 'Idiomas', icono: 'languages' },
      { id: 4, nombre: 'Marketing', icono: 'megaphone' },
      { id: 5, nombre: 'Negocios', icono: 'briefcase' },
      { id: 6, nombre: 'Ofimática', icono: 'monitor' },
      { id: 7, nombre: 'Música', icono: 'music' },
      { id: 8, nombre: 'Ciencias', icono: 'atom' },
    ];
    const { fixture } = montar(false, ocho);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const barraCat = el.querySelector('nav.barra-categorias') as HTMLElement;
    expect(barraCat).not.toBeNull();
    expect(barraCat.classList.contains('oculto-movil')).toBe(true);

    const enlaces = Array.from(barraCat.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(enlaces).toEqual(['Programación', 'Diseño', 'Idiomas', 'Marketing', 'Negocios', 'Ofimática']);
  });
});

