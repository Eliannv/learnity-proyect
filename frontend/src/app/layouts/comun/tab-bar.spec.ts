import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { ICONOS } from '../../shared/ui/marca/iconos';
import { MENU } from '../panel/menu-panel';
import { type ItemTab, TabBar } from './tab-bar';

@Component({ template: '' })
class Vacia {}

@Component({
  imports: [TabBar],
  template: '<app-tab-bar [items]="items" [mas]="mas" />',
})
class Anfitrion {
  items: ItemTab[] = MENU.ADMIN.tabs;
  mas: ItemTab[] = MENU.ADMIN.items.filter((i) => !MENU.ADMIN.tabs.some((t) => t.ruta === i.ruta));
}

function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
      { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) },
    ],
  });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  return fixture;
}

const botonMas = (el: HTMLElement) => el.querySelector('.boton-mas') as HTMLButtonElement;

describe('barra inferior del panel', () => {
  it('el administrador tiene cuatro pestañas y «Más»; todas sus secciones son alcanzables en el móvil', () => {
    const fixture = montar();
    const el = fixture.nativeElement as HTMLElement;
    const pestanas = [...el.querySelectorAll('.tab-bar a')].map((a) => a.textContent!.trim());
    expect(pestanas).toEqual(['Resumen', 'Usuarios', 'Cursos', 'Alertas']);
    expect(botonMas(el).getAttribute('aria-expanded')).toBe('false');

    botonMas(el).click();
    fixture.detectChanges();
    expect(botonMas(el).getAttribute('aria-expanded')).toBe('true');
    const enMas = [...el.querySelectorAll('#tab-bar-mas a')].map((a) => a.getAttribute('href'));
    const alcanzables = new Set([...el.querySelectorAll('.tab-bar a')].map((a) => a.getAttribute('href')).concat(enMas));
    for (const item of MENU.ADMIN.items) expect(alcanzables).toContain(item.ruta);
  });

  it('se cierra con Escape y la pestaña «Más» queda activa en una de sus secciones', async () => {
    const fixture = montar();
    const el = fixture.nativeElement as HTMLElement;
    botonMas(el).click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    // Baja por el mismo camino por el que subió y se desmonta al terminar; el foco vuelve al momento.
    expect(el.querySelector('#tab-bar-mas')?.classList).toContain('saliendo');
    expect(botonMas(el).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botonMas(el));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('#tab-bar-mas')).toBeNull();
    });

    await TestBed.inject(Router).navigateByUrl('/admin/auditoria');
    fixture.detectChanges();
    expect(botonMas(el).classList).toContain('activo');
  });

  it('el docente no necesita «Más»: todas sus secciones caben', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }],
    });
    const fixture = TestBed.createComponent(TabBar);
    fixture.componentRef.setInput('items', MENU.DOCENTE.tabs);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.boton-mas')).toBeNull();
    expect(MENU.DOCENTE.items.every((i) => MENU.DOCENTE.tabs.some((t) => t.ruta === i.ruta))).toBe(true);
  });
});
