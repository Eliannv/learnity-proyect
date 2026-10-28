import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import {
  ApplicationConfig,
  LOCALE_ID,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { ICONOS } from './shared/ui/iconos';

// Fechas («28 oct 2026») y decimales («4,5») en español en todos los pipes.
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es' },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      // Protección CSRF: copia la cookie XSRF-TOKEN del backend en el encabezado X-XSRF-TOKEN (POST/PUT/DELETE).
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // Antes de la primera navegación: recupera la sesión con la cookie (así los guards ya saben quién es).
    provideAppInitializer(() => inject(AuthService).restaurarSesion()),
    importProvidersFrom(LucideAngularModule.pick(ICONOS)),
  ],
};
