/**
 * Pruebas de las guardias de ruta.
 *
 * Regla cubierta: nadie entra a las pantallas privadas sin sesión, y cada rol
 * solo accede a lo suyo. La interfaz ya oculta los menús, pero la URL se puede
 * escribir a mano: la guardia es la que realmente bloquea.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import {
  authGuard,
  soloInvitadoGuard,
  compradorGuard,
  staffGuard,
  soloAdminGuard
} from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('Guardias de ruta', () => {
  let authService: AuthService;
  let router: Router & { createUrlTree: jasmine.Spy };

  beforeEach(() => {
    localStorage.clear();

    // Router falso: devuelve la misma ruta que se le pide, para poder comprobar
    // a dónde redirige cada guardia.
    const routerFalso = {
      createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((comandos: unknown) => comandos),
      navigateByUrl: jasmine.createSpy('navigateByUrl')
    };

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: Router, useValue: routerFalso }]
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router) as Router & { createUrlTree: jasmine.Spy };
  });

  afterEach(() => localStorage.clear());

  /** Ejecuta una guardia dentro del contexto de inyección de Angular. */
  const ejecutar = (guardia: CanActivateFn) =>
    TestBed.runInInjectionContext(() =>
      guardia({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

  describe('authGuard — requiere sesión', () => {
    it('sin sesión redirige al login', () => {
      const resultado = ejecutar(authGuard);
      expect(resultado).toEqual(['/login'] as unknown as UrlTree);
    });

    it('con sesión deja pasar', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(true);
      expect(ejecutar(authGuard)).toBeTrue();
    });
  });

  describe('soloInvitadoGuard — login y registro', () => {
    it('sin sesión deja pasar al login', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(false);
      expect(ejecutar(soloInvitadoGuard)).toBeTrue();
    });

    it('con sesión iniciada manda al inicio (evita volver a entrar al login)', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(true);
      expect(ejecutar(soloInvitadoGuard)).toEqual(['/home'] as unknown as UrlTree);
    });
  });

  describe('guardias por rol', () => {
    it('compradorGuard deja pasar a cliente y admin', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(true);
      const rol = spyOn(authService, 'getRol');

      rol.and.returnValue('cliente');
      expect(ejecutar(compradorGuard)).toBeTrue();

      rol.and.returnValue('admin');
      expect(ejecutar(compradorGuard)).toBeTrue();
    });

    it('compradorGuard rechaza al pastelero', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(true);
      spyOn(authService, 'getRol').and.returnValue('pastelero');

      expect(ejecutar(compradorGuard)).toEqual(['/home'] as unknown as UrlTree);
    });

    it('staffGuard deja pasar a pastelero y admin, y rechaza al cliente', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(true);
      const rol = spyOn(authService, 'getRol');

      rol.and.returnValue('pastelero');
      expect(ejecutar(staffGuard)).toBeTrue();

      rol.and.returnValue('admin');
      expect(ejecutar(staffGuard)).toBeTrue();

      rol.and.returnValue('cliente');
      expect(ejecutar(staffGuard)).toEqual(['/home'] as unknown as UrlTree);
    });

    it('soloAdminGuard solo deja pasar al admin', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(true);
      const rol = spyOn(authService, 'getRol');

      rol.and.returnValue('admin');
      expect(ejecutar(soloAdminGuard)).toBeTrue();

      rol.and.returnValue('cliente');
      expect(ejecutar(soloAdminGuard)).toEqual(['/home'] as unknown as UrlTree);
    });

    it('sin sesión, cualquier guardia de rol manda al login', () => {
      spyOn(authService, 'estaAutenticado').and.returnValue(false);

      expect(ejecutar(compradorGuard)).toEqual(['/login'] as unknown as UrlTree);
      expect(ejecutar(staffGuard)).toEqual(['/login'] as unknown as UrlTree);
      expect(ejecutar(soloAdminGuard)).toEqual(['/login'] as unknown as UrlTree);
    });
  });
});
