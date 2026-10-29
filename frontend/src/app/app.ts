import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Confirmacion } from './shared/ui/retroalimentacion/confirmacion';
import { Toasts } from './shared/ui/retroalimentacion/toasts';
import { ErrorCarga } from './shared/ui/retroalimentacion/error-carga';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, Confirmacion, ErrorCarga],
  template: '<router-outlet /><app-toasts /><app-confirmacion /><app-error-carga />',
})
export class App {}
