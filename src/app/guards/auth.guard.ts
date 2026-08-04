import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege rutas privadas (como /tienda o /checkout).
 * Si no hay sesión, manda al usuario al Login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Permite acceder a Login / Registro solo si NO hay sesión activa.
 * Si ya hay sesión iniciada, los manda a /home en lugar de /tienda.
 */
export const soloInvitadoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    // Redirige al inicio/home si ya está autenticado
    return router.createUrlTree(['/home']);
  }
  
  return true;
};