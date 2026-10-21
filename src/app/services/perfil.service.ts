import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CambioPasswordPayload,
  DireccionCandidata,
  DireccionDelPunto,
  Perfil,
  PerfilPayload
} from '../models/perfil.model';

/**
 * Servicio de "Mi perfil" y de búsqueda de direcciones.
 *
 * Todas las rutas exigen token; el interceptor (auth.interceptor.ts) lo adjunta
 * solo, así que aquí no se arma ninguna cabecera a mano.
 */
@Injectable({
  providedIn: 'root'
})
export class PerfilService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** GET /api/usuarios/:id/perfil */
  obtenerPerfil(idUsuario: number): Observable<Perfil> {
    return this.http.get<Perfil>(`${this.apiUrl}/usuarios/${idUsuario}/perfil`);
  }

  /** PUT /api/usuarios/:id/perfil — devuelve el perfil ya guardado */
  actualizarPerfil(
    idUsuario: number,
    datos: PerfilPayload
  ): Observable<{ mensaje: string; perfil: Perfil }> {
    return this.http.put<{ mensaje: string; perfil: Perfil }>(
      `${this.apiUrl}/usuarios/${idUsuario}/perfil`,
      datos
    );
  }

  /**
   * PUT /api/usuarios/:id/password
   * El backend exige la contraseña actual: verla no basta, hay que saberla.
   */
  cambiarPassword(
    idUsuario: number,
    datos: CambioPasswordPayload
  ): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(
      `${this.apiUrl}/usuarios/${idUsuario}/password`,
      datos
    );
  }

  /**
   * GET /api/geocodificacion/buscar?q=...
   *
   * La búsqueda la hace el backend contra Nominatim: el navegador no puede
   * fijar el User-Agent que exige la política de uso y el límite de 1 petición
   * por segundo es global, no por pestaña.
   */
  buscarDireccion(consulta: string): Observable<DireccionCandidata[]> {
    const params = new HttpParams().set('q', consulta);
    return this.http.get<DireccionCandidata[]>(`${this.apiUrl}/geocodificacion/buscar`, {
      params
    });
  }

  /** GET /api/geocodificacion/reversa?lat=..&lon=.. — dirección del punto marcado */
  direccionDelPunto(latitud: number, longitud: number): Observable<DireccionDelPunto> {
    const params = new HttpParams()
      .set('lat', String(latitud))
      .set('lon', String(longitud));
    return this.http.get<DireccionDelPunto>(`${this.apiUrl}/geocodificacion/reversa`, {
      params
    });
  }
}
