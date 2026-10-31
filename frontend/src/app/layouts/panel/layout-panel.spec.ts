import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../shared/ui/marca/iconos';
import { AuthService } from '../../core/auth/auth.service';
import { LayoutPanel } from './layout-panel';

@Component({ template: '' })
class VistaPrueba {}

describe('LayoutPanel - Selector y conmutador de paneles', () => {
  const crearAuthMock = (esAdmin = true, esDocente = true) => ({
    esAdmin: signal(esAdmin),
    esDocente: signal(esDocente),
    usuario: signal({ nombres: 'Elian', apellidos: 'Valarezo', correo: 'elian@example.com' }),
    iniciales: signal('EV'),
    nombreCompleto: signal('Elian Valarezo'),
    rutaPerfil: signal('/admin/perfil'),
    roles: signal(esAdmin && esDocente ? ['ADMIN', 'DOCENTE'] : esAdmin ? ['ADMIN'] : ['DOCENTE']),
    cerrarSesion: () => {},
  });

  const montar = (rol: 'ADMIN' | 'DOCENTE', esAdmin = true, esDocente = true) => {
    const authMock = crearAuthMock(esAdmin, esDocente);
    TestBed.configureTestingModule({
      imports: [LayoutPanel],
      providers: [
        provideRouter([
          { path: 'admin', component: VistaPrueba },
          { path: 'docente', component: VistaPrueba },
          { path: '**', component: VistaPrueba },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ rol, seccion: 'Resumen' }),
            snapshot: { data: { rol, seccion: 'Resumen' } },
          },
        },
        { provide: AuthService, useValue: authMock },
        { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
      ],
    });
    const fixture = TestBed.createComponent(LayoutPanel);
    fixture.detectChanges();
    return { fixture, authMock };
  };

  it('cuenta con ambos roles: muestra selector interactivo con chevron y sin conmutador rectangular antiguo', () => {
    const { fixture } = montar('ADMIN', true, true);
    const el = fixture.nativeElement as HTMLElement;

    // Ya no debe existir el contenedor rectangular segmentado antiguo
    expect(el.querySelector('.conmutador')).toBeNull();
    // Ya no debe existir el enlace redundante que saturaba la barra móvil
    expect(el.querySelector('.otro-panel')).toBeNull();

    // En la cabecera lateral, se muestra el selector interactivo al lado de Learnity
    const btnLateral = el.querySelector('.cabecera-lateral .btn-rol-selector') as HTMLButtonElement;
    expect(btnLateral).not.toBeNull();
    expect(btnLateral.textContent).toContain('Admin');
    expect(btnLateral.getAttribute('aria-expanded')).toBe('false');

    // Despliega el menú al hacer clic
    btnLateral.click();
    fixture.detectChanges();

    expect(btnLateral.getAttribute('aria-expanded')).toBe('true');
    const menu = el.querySelector('.menu-desplegable-paneles.menu-lateral');
    expect(menu).not.toBeNull();

    // Debe listar Panel Administrador y Panel Docente
    const opciones = [...el.querySelectorAll('.menu-lateral .opcion-panel')];
    expect(opciones.length).toBe(2);
    expect(opciones[0].textContent).toContain('Panel Administrador');
    expect(opciones[1].textContent).toContain('Panel Docente');

    // El panel activo tiene la clase activa y su check
    expect(opciones[0].classList.contains('activa')).toBe(true);
    expect(opciones[0].querySelector('.opcion-check')).not.toBeNull();

    // Se cierra al presionar Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.menu-desplegable-paneles.menu-lateral')).toBeNull();
  });

  it('cuenta con un solo rol: muestra etiqueta fija sin chevron ni menú desplegable', () => {
    const { fixture } = montar('DOCENTE', false, true);
    const el = fixture.nativeElement as HTMLElement;

    // No debe existir selector interactivo con botón
    expect(el.querySelector('.cabecera-lateral .btn-rol-selector')).toBeNull();
    expect(el.querySelector('.conmutador')).toBeNull();

    // Debe mostrar la etiqueta fija
    const etiquetaFija = el.querySelector('.cabecera-lateral .rol-estatico');
    expect(etiquetaFija).not.toBeNull();
    expect(etiquetaFija?.textContent?.trim()).toBe('Docente');
  });

  it('cierra el menú al hacer clic fuera del componente', () => {
    const { fixture } = montar('ADMIN', true, true);
    const el = fixture.nativeElement as HTMLElement;

    const btnLateral = el.querySelector('.cabecera-lateral .btn-rol-selector') as HTMLButtonElement;
    btnLateral.click();
    fixture.detectChanges();
    expect(el.querySelector('.menu-desplegable-paneles.menu-lateral')).not.toBeNull();

    // Clic fuera en el documento
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.menu-desplegable-paneles.menu-lateral')).toBeNull();
  });
});
