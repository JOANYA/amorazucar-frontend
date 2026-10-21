/**
 * Pruebas del interceptor de autenticación.
 *
 * Reglas cubiertas:
 *  - Las rutas de login/registro NO deben llevar token (no hay sesión todavía).
 *  - El resto de peticiones sí lo llevan, para que el backend identifique al
 *    usuario.
 */
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';

const CLAVE_TOKEN = 'azucaryamor_token';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('añade la cabecera Authorization cuando hay token guardado', () => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');

    http.get('/api/postres').subscribe();

    const peticion = httpMock.expectOne('/api/postres');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    peticion.flush([]);
  });

  it('no añade la cabecera si no hay token', () => {
    http.get('/api/postres').subscribe();

    const peticion = httpMock.expectOne('/api/postres');
    expect(peticion.request.headers.has('Authorization')).toBeFalse();
    peticion.flush([]);
  });

  it('NO envía el token al iniciar sesión (aún no existe la sesión)', () => {
    localStorage.setItem(CLAVE_TOKEN, 'token-viejo');

    http.post('/api/usuarios/login', { dni: '70000003', password_hash: 'x' }).subscribe();

    const peticion = httpMock.expectOne('/api/usuarios/login');
    expect(peticion.request.headers.has('Authorization')).toBeFalse();
    peticion.flush({});
  });

  it('NO envía el token al registrarse', () => {
    localStorage.setItem(CLAVE_TOKEN, 'token-viejo');

    http.post('/api/usuarios/registro', {}).subscribe();

    const peticion = httpMock.expectOne('/api/usuarios/registro');
    expect(peticion.request.headers.has('Authorization')).toBeFalse();
    peticion.flush({});
  });

  it('sí envía el token a una ruta que solo lo contiene como parte del nombre', () => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');

    // Antes el interceptor usaba includes() y esta URL se quedaba sin token.
    http.get('/api/postres/login-destacados').subscribe();

    const peticion = httpMock.expectOne('/api/postres/login-destacados');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    peticion.flush([]);
  });
});
