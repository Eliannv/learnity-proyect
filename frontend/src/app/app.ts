import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Confirmacion } from './shared/ui/confirmacion';
import { Toasts } from './shared/ui/toasts';
import { ErrorCarga } from './shared/ui/error-carga';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts, Confirmacion, ErrorCarga],
  template: '<router-outlet /><app-toasts /><app-confirmacion /><app-error-carga />',
})
export class App {}
