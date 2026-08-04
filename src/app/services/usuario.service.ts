import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from '../models/usuario.model';

/**
 * Operaciones adicionales sobre /api/usuarios que NO son login/registro.
 * Nota: en el backend estas rutas están protegidas con `verificarToken`
 * (usuarioRoutes.js). Actualmente el login no emite un JWT, así que estos
 * métodos quedarán listos para usarse en cuanto el backend entregue el token.
 */
@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  /** GET /api/usuarios (requiere token + rol admin) */
  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  /** GET /api/usuarios/:id (requiere token) */
  obtenerPorId(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  /** PUT /api/usuarios/:id/estado (requiere token + rol admin) */
  actualizarEstado(id: number, estado: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
