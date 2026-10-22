import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Al cambiar de página se vuelve arriba (y el botón "atrás" del navegador
    // restaura la posición anterior). Sin esto, entrar a /entregas desde el pie
    // de la home dejaba la galería abierta a mitad de scroll.
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
};