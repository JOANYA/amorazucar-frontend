import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guardias de ruta.
 *
 * Antes solo existía `authGuard`, que comprobaba "hay sesión" pero NO el rol,
 * y las rutas hijas de /menu no tenían ninguna guardia. Ahora:
 *   - authGuard        -> requiere sesión
 *   - soloInvitadoGuard-> solo si NO hay sesión (login / registro)
 *   - compradorGuard   -> admin o cliente
 *   - staffGuard       -> admin o pastelero
 *   - soloAdminGuard   -> solo admin
 *
 * El rol se lee del JWT (ver AuthService), no de un objeto editable, y el
 * backend vuelve a validarlo en cada petición.
 */

/** Protege rutas privadas: sin sesión, manda al login. */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

/** Permite ver Login / Registro solo si NO hay sesión activa. */
export const soloInvitadoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return router.createUrlTree(['/home']);
  }
  return true;
};

/** Requiere sesión y uno de los roles indicados. */
function guardiaPorRol(rolesPermitidos: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.estaAutenticado()) {
      return router.createUrlTree(['/login']);
    }

    const rol = authService.getRol();
    if (!rol || !rolesPermitidos.includes(rol)) {
      // Autenticado pero sin permiso: se le devuelve al inicio, no al login.
      return router.createUrlTree(['/home']);
    }

    return true;
  };
}

/** Quien puede comprar: administración o cliente. */
export const compradorGuard = guardiaPorRol(['admin', 'cliente']);

/** Quien puede gestionar catálogo y pedidos: administración o cocina. */
export const staffGuard = guardiaPorRol(['admin', 'pastelero']);

/** Solo administración. */
export const soloAdminGuard = guardiaPorRol(['admin']);
