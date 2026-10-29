import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { describe, expect, it, vi } from 'vitest';

import { ICONOS } from '../marca/iconos';
import { EstadoVistaComponent } from './estado-vista';
import { Modal } from './modal';

const proveedores = [{ provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(ICONOS) }];

describe('EstadoVistaComponent', () => {
  function crear(estado: 'cargando' | 'vacio' | 'error', extra: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: proveedores });
    const fixture = TestBed.createComponent(EstadoVistaComponent);
    fixture.componentRef.setInput('estado', estado);
    for (const [clave, valor] of Object.entries(extra)) fixture.componentRef.setInput(clave, valor);
    fixture.detectChanges();
    return fixture;
  }

  it('anuncia la carga como estado ocupado', () => {
    const caja = crear('cargando').nativeElement.querySelector('.estado');
    expect(caja.getAttribute('role')).toBe('status');
    expect(caja.getAttribute('aria-busy')).toBe('true');
    expect(caja.textContent).toContain('Cargando');
  });

  it('muestra un vacío con título y mensaje propios', () => {
    const texto = crear('vacio', { titulo: 'Sin cursos', mensaje: 'Crea el primero.' }).nativeElement.textContent;
    expect(texto).toContain('Sin cursos');
    expect(texto).toContain('Crea el primero.');
  });

  it('el error es una alerta y reintentar emite', () => {
    const fixture = crear('error', { mensaje: 'Falló' });
    const alerta = fixture.nativeElement.querySelector('[role="alert"]');
    const reintentar = vi.fn();
    fixture.componentInstance.reintentar.subscribe(reintentar);

    expect(alerta).not.toBeNull();
    fixture.nativeElement.querySelector('button').click();
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('oculta Reintentar si no es reintentable', () => {
    const fixture = crear('error', { reintentable: false });
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});

@Component({
  imports: [Modal],
  template: `
    <button id="abrir" (click)="abierto = true">abrir</button>
    @if (abierto) {
      <app-modal titulo="Prueba" (cerrar)="abierto = false">
        <input id="uno" />
        <button id="dos">dos</button>
      </app-modal>
    }
  `,
})
class Anfitrion {
  abierto = false;
}

describe('Modal', () => {
  async function abrir() {
    TestBed.configureTestingModule({ providers: proveedores });
    const fixture = TestBed.createComponent(Anfitrion);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const abrirBtn: HTMLButtonElement = fixture.nativeElement.querySelector('#abrir');
    abrirBtn.focus();
    abrirBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, abrirBtn };
  }

  it('lleva el foco al diálogo y lo atrapa con Tab', async () => {
    const { fixture } = await abrir();
    const modal: HTMLElement = fixture.nativeElement.querySelector('app-modal');
    const cerrarX = modal.querySelector<HTMLElement>('.cerrar')!;
    const dos = modal.querySelector<HTMLElement>('#dos')!;

    expect(modal.contains(document.activeElement)).toBe(true);

    dos.focus();
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(cerrarX);

    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(dos);
  });

  it('cierra con Escape y devuelve el foco a quien lo abrió', async () => {
    const { fixture, abrirBtn } = await abrir();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-modal')).toBeNull();
    expect(document.activeElement).toBe(abrirBtn);
  });
});
