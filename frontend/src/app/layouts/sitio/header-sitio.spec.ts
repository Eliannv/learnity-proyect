import { Component, signal } from '@angular/core';
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

  const montar = (autenticado = false) => {
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
      categorias: vi.fn().mockResolvedValue([]),
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
});
