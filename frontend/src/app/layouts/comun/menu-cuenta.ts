import { Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { Avatar } from '../../shared/ui/marca/avatar';

/**
 * Foto de perfil del header (sitio y paneles).
 *  - Pasar el mouse (o enfocarla con el teclado): muestra el menú con todo lo que puede hacer la cuenta.
 *  - Clic: Estudiante → Mi perfil (/perfil); Docente o Administrador → Ajustes y perfil dentro de su panel.
 * El menú es la única entrada a los paneles de Docente y Administración.
 */
@Component({
  selector: 'app-menu-cuenta',
  imports: [RouterLink, LucideAngularModule, Avatar],
  host: {
    '(mouseenter)': 'abrir()',
    '(mouseleave)': 'cerrarConPausa()',
    '(focusin)': 'abrir()',
    '(focusout)': 'alPerderFoco($event)',
    '(document:keydown.escape)': 'abierto.set(false)',
  },
  template: `
    <a class="avatar-btn" [routerLink]="auth.rutaPerfil()" [attr.aria-expanded]="abierto()" aria-haspopup="menu" [attr.aria-label]="'Mi perfil, ' + auth.nombreCompleto()" (click)="cerrar()">
      <app-avatar [texto]="auth.iniciales()" [imagen]="auth.usuario()?.fotoUrl" [tamano]="40" [solido]="true" />
    </a>

    @if (abierto()) {
      <div class="menu" role="menu">
        <a class="quien" [routerLink]="auth.rutaPerfil()" (click)="cerrar()" role="menuitem">
          <app-avatar [texto]="auth.iniciales()" [imagen]="auth.usuario()?.fotoUrl" [tamano]="56" [solido]="true" />
          <span>
            <strong>{{ auth.nombreCompleto() }}</strong>
            <small>{{ auth.usuario()?.correo }}</small>
          </span>
        </a>

        @if (auth.esDocente() || auth.esAdmin()) {
          <div class="grupo">
            <span class="eyebrow">Paneles</span>
            @if (auth.esDocente()) {
              <a routerLink="/docente" (click)="cerrar()" role="menuitem">
                <lucide-icon name="presentation" [size]="18" /> Panel del docente
              </a>
            }
            @if (auth.esAdmin()) {
              <a routerLink="/admin" (click)="cerrar()" role="menuitem">
                <lucide-icon name="shield-check" [size]="18" /> Administración
              </a>
            }
          </div>
        }

        @if (auth.roles().includes('ESTUDIANTE') || (!auth.esDocente() && !auth.esAdmin())) {
          <div class="grupo">
            @if (auth.roles().includes('ESTUDIANTE')) {
              <a routerLink="/mi-aprendizaje" (click)="cerrar()" role="menuitem">
                <lucide-icon name="graduation-cap" [size]="18" /> Mi aprendizaje
              </a>
            }
            @if (!auth.esDocente() && !auth.esAdmin()) {
              <a routerLink="/perfil" [queryParams]="{ solicitud: 1 }" (click)="cerrar()" role="menuitem">
                <lucide-icon name="presentation" [size]="18" /> Enseña en Learnity
              </a>
            }
          </div>
        }

        <div class="grupo">
          <a [routerLink]="auth.rutaPerfil()" (click)="cerrar()" role="menuitem">
            <lucide-icon name="user" [size]="18" /> Mi perfil
          </a>
          <button type="button" class="salir" (click)="auth.cerrarSesion()" role="menuitem">
            <lucide-icon name="log-out" [size]="18" /> Cerrar sesión
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    .avatar-btn {
      display: block;
      border-radius: 50%;
    }
    /* Puente invisible: el mouse no "cae" entre la foto y el menú */
    .menu::before {
      content: '';
      position: absolute;
      top: -12px;
      left: 0;
      right: 0;
      height: 12px;
    }
    .menu {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: 70;
      width: 288px;
      border: 1px solid var(--gris-200);
      border-radius: var(--radio-md);
      background: var(--blanco);
      color: var(--tinta-900);
      box-shadow: 0 16px 40px rgb(15 23 42 / 16%);
      animation: aparecer 0.14s ease-out;
    }
    .quien {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      color: var(--tinta-900);
      span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      strong {
        font-size: 16px;
      }
      small {
        font-size: 13px;
        color: var(--gris-500);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      &:hover strong {
        color: var(--azul-700);
      }
    }
    .grupo {
      display: flex;
      flex-direction: column;
      padding: 8px;
      border-top: 1px solid var(--gris-200);
      .eyebrow {
        padding: 6px 10px 4px;
        font-size: 11px;
      }
      a,
      button {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        padding: 0 10px;
        border: 0;
        border-radius: var(--radio);
        background: none;
        color: var(--tinta-900);
        font-size: 15px;
        text-align: left;
        lucide-icon {
          color: var(--gris-500);
        }
        &:hover {
          background: var(--azul-050);
          lucide-icon {
            color: var(--azul-700);
          }
        }
      }
      .salir,
      .salir lucide-icon {
        color: var(--rojo-700);
      }
    }
    @keyframes aparecer {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .menu {
        animation: none;
      }
    }
  `,
})
export class MenuCuenta implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly elemento = inject(ElementRef<HTMLElement>);
  private temporizador?: ReturnType<typeof setTimeout>;
  protected readonly abierto = signal(false);

  protected abrir() {
    clearTimeout(this.temporizador);
    this.abierto.set(true);
  }

  /** Pequeña pausa al salir: evita que el menú se cierre al mover el mouse en diagonal. */
  protected cerrarConPausa() {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.abierto.set(false), 180);
  }

  protected cerrar() {
    clearTimeout(this.temporizador);
    this.abierto.set(false);
  }

  protected alPerderFoco(evento: FocusEvent) {
    if (!this.elemento.nativeElement.contains(evento.relatedTarget as Node | null)) this.abierto.set(false);
  }

  ngOnDestroy() {
    clearTimeout(this.temporizador);
  }
}
