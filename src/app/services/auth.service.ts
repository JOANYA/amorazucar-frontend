import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  LoginResponse,
  RegistroResponse,
  Usuario,
  UsuarioLogin,
  UsuarioRegistro
} from '../models/usuario.model';

const STORAGE_KEY = 'azucaryamor_usuario';

/**
 * Servicio de autenticación.
 *
 * IMPORTANTE sobre el backend actual:
 * `POST /api/usuarios/login` (usuario.controller.js -> exports.login) responde
 * `{ mensaje, usuario }` y NO genera ni devuelve un token JWT todavía
 * (el middleware `generarToken` existe en src/middlewares/auth.js pero el
 * controlador de login no lo invoca). Por eso esta sesión se maneja guardando
 * el objeto `usuario` en localStorage en vez de un Bearer token.
 * Si en el futuro el backend agrega el token al login, el interceptor
 * (auth.interceptor.ts) ya está listo para adjuntarlo automáticamente.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Forzamos la URL directa de Render para producción en Vercel
  private apiUrl = 'https://amorazucar-backend.onrender.com/api/usuarios';

  private usuarioActualSubject = new BehaviorSubject<Usuario | null>(this.leerUsuarioGuardado());
  usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** POST /api/usuarios/login — body: { dni, password_hash } */
  login(credenciales: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credenciales).pipe(
      tap((response) => {
        // Antes solo se guardaba el token y nunca se llamaba guardarSesion().
        // Por eso usuarioActualSubject seguía en null y estaAutenticado()
        // devolvía false incluso con un login exitoso -> el authGuard
        // rebotaba de vuelta a /login.
        if (response?.token) {
          localStorage.setItem('azucaryamor_token', response.token);
        }
        if (response?.usuario) {
          this.guardarSesion(response.usuario);
        }
      })
    );
  }

  /** POST /api/usuarios/registro — body: { dni, nombre, apellido, password_hash, rol, telefono, correo, estado } */
  registro(datos: UsuarioRegistro): Observable<RegistroResponse> {
    return this.http.post<RegistroResponse>(`${this.apiUrl}/registro`, datos);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.usuarioActualSubject.next(null);
  }

  estaAutenticado(): boolean {
    return this.usuarioActualSubject.value !== null;
  }

  /**
   * Evalúa si el usuario en sesión es Administrador.
   * Valida si el campo `rol` es 'ADMIN' / 'administrador' o si existe la propiedad boolean `esAdmin`.
   */
  esAdmin(): boolean {
    const usuario = this.getUsuarioActual();
    if (!usuario) return false;

    // Normaliza el rol a mayúsculas si viene en texto
    const rol = usuario.rol ? String(usuario.rol).toUpperCase() : '';

    return (
      rol === 'ADMIN' ||
      rol === 'ADMINISTRADOR' ||
      (usuario as any).esAdmin === true
    );
  }

  getUsuarioActual(): Usuario | null {
    return this.usuarioActualSubject.value;
  }

  private guardarSesion(usuario: Usuario): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
    this.usuarioActualSubject.next(usuario);
  }

  private leerUsuarioGuardado(): Usuario | null {
    const crudo = localStorage.getItem(STORAGE_KEY);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as Usuario;
    } catch {
      return null;
    }
  }
}