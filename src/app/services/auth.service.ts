import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { CarritoService } from './carrito.service';
import {
  LoginResponse,
  RegistroResponse,
  RolUsuario,
  Usuario,
  UsuarioRegistro
} from '../models/usuario.model';

const CLAVE_TOKEN = 'azucaryamor_token';
const CLAVE_USUARIO = 'azucaryamor_usuario';

interface PayloadJwt {
  id_usuario?: number;
  rol?: RolUsuario;
  dni?: string;
  correo?: string | null;
  exp?: number;
}

/** Decodifica el payload de un JWT (sin verificar la firma: eso lo hace el backend). */
function decodificarJwt(token: string): PayloadJwt | null {
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(relleno)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as PayloadJwt;
  } catch {
    return null;
  }
}

function tokenExpirado(payload: PayloadJwt | null): boolean {
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}

/**
 * Servicio de autenticación.
 *
 * CAMBIO IMPORTANTE DE SEGURIDAD:
 * Antes el rol que usaba la interfaz (esAdmin) salía del objeto guardado en
 * localStorage, así que bastaba editar `azucaryamor_usuario` y poner
 * {"rol":"admin"} para que un cliente viera el panel de administración.
 * Ahora el rol se lee SIEMPRE del payload del JWT (firmado por el backend) y
 * si el token no existe, está caducado o no se puede decodificar, la sesión
 * se considera cerrada.
 *
 * Nota: esto endurece la INTERFAZ. La autorización real la sigue haciendo el
 * backend (403 en cada ruta protegida), que es la única defensa infalsificable.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/usuarios`;

  private usuarioActualSubject = new BehaviorSubject<Usuario | null>(this.leerSesionGuardada());
  usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor(
    private http: HttpClient,
    private carritoService: CarritoService
  ) {}

  /** POST /api/usuarios/login — body: { dni, password_hash } */
  login(credenciales: { dni: string; password_hash: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credenciales).pipe(
      tap((response) => {
        if (!response?.token) return;

        localStorage.setItem(CLAVE_TOKEN, response.token);

        const payload = decodificarJwt(response.token);
        const usuario: Usuario = {
          ...(response.usuario as Usuario),
          // El rol de la interfaz viene del token firmado, no de un objeto editable
          rol: (payload?.rol ?? response.usuario?.rol) as RolUsuario,
          id_usuario: payload?.id_usuario ?? response.usuario?.id_usuario
        };

        this.guardarSesion(usuario);
      })
    );
  }

  /** POST /api/usuarios/registro — el backend fuerza el rol 'cliente'. */
  registro(datos: UsuarioRegistro): Observable<RegistroResponse> {
    return this.http.post<RegistroResponse>(`${this.apiUrl}/registro`, datos);
  }

  /**
   * Cierra la sesión y deja el carrito vacío.
   *
   * El carrito se guarda en el navegador (ver CarritoService), así que si no
   * se limpiara aquí, quien entre después en el mismo equipo encontraría los
   * productos que dejó el usuario anterior.
   */
  logout(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    this.carritoService.vaciar();
    this.usuarioActualSubject.next(null);
  }

  estaAutenticado(): boolean {
    return this.usuarioActualSubject.value !== null;
  }

  getUsuarioActual(): Usuario | null {
    return this.usuarioActualSubject.value;
  }

  /** Rol del usuario en sesión, tomado del JWT. */
  getRol(): RolUsuario | null {
    return this.usuarioActualSubject.value?.rol ?? null;
  }

  esAdmin(): boolean {
    return this.getRol() === 'admin';
  }

  /** Puede ver el catálogo y comprar (admin o cliente). */
  puedeComprar(): boolean {
    return ['admin', 'cliente'].includes(this.getRol() ?? '');
  }

  /** Puede gestionar el catálogo de postres (admin o pastelero). */
  puedeGestionarCatalogo(): boolean {
    return ['admin', 'pastelero'].includes(this.getRol() ?? '');
  }

  /**
   * Refresca los datos del usuario en sesión después de editarlos en el perfil.
   *
   * El rol y el id NO se pueden cambiar por aquí: se vuelven a tomar del token
   * firmado para que nadie pueda "ascenderse" editando el localStorage. Sin
   * esto, el menú seguiría saludando con el nombre anterior hasta el próximo
   * inicio de sesión.
   */
  actualizarDatosLocales(parcial: Partial<Usuario>): void {
    const actual = this.usuarioActualSubject.value;
    if (!actual) return;

    this.guardarSesion({
      ...actual,
      ...parcial,
      rol: actual.rol,
      id_usuario: actual.id_usuario
    });
  }

  private guardarSesion(usuario: Usuario): void {
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    this.usuarioActualSubject.next(usuario);
  }

  /**
   * Restaura la sesión al recargar la página, pero SOLO si hay un token válido
   * y sin caducar. Si el token ya expiró, se limpia la sesión por completo.
   */
  private leerSesionGuardada(): Usuario | null {
    const token = localStorage.getItem(CLAVE_TOKEN);
    if (!token) {
      localStorage.removeItem(CLAVE_USUARIO);
      return null;
    }

    const payload = decodificarJwt(token);
    if (!payload || tokenExpirado(payload)) {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
      return null;
    }

    const crudo = localStorage.getItem(CLAVE_USUARIO);
    let usuario: Usuario | null = null;
    try {
      usuario = crudo ? (JSON.parse(crudo) as Usuario) : null;
    } catch {
      usuario = null;
    }

    if (!usuario) return null;

    // El rol y el id SIEMPRE se re-derivan del token, por si el localStorage
    // fue manipulado.
    return {
      ...usuario,
      rol: payload.rol as RolUsuario,
      id_usuario: payload.id_usuario ?? usuario.id_usuario
    };
  }
}
