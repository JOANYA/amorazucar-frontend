import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Postre } from '../models/catalogo.model';

export type { Postre };

/**
 * Servicio para el catálogo público de la pastelería.
 * Consume rutas que en el backend NO requieren token:
 *   GET /api/postres
 *   GET /api/menu-dia/hoy
 */
@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

 listarPostres(): Observable<any[]> {
  const token = localStorage.getItem('token');
  
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });

  return this.http.get<any[]>(`${this.apiUrl}/postres`, { headers });
}
  /** GET /api/menu-dia/hoy */
  obtenerMenuHoy(): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.apiUrl}/menu-dia/hoy`);
  }
  crearPostre(postre: any): Observable<Postre> {
  return this.http.post<Postre>(`${this.apiUrl}/postres`, postre);
}

actualizarPostre(id: number, postre: any): Observable<Postre> {
  return this.http.put<Postre>(`${this.apiUrl}/postres/${id}`, postre);
}

eliminarPostre(id: number): Observable<void> {
  const token = localStorage.getItem('token');
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });
  return this.http.delete<void>(`${this.apiUrl}/postres/${id}`, { headers });
}

/** POST /api/postres/:id/imagen — sube o reemplaza la foto del postre (multipart) */
subirImagenPostre(id: number, archivo: File): Observable<{ mensaje: string; imagen: string }> {
  const formData = new FormData();
  formData.append('imagen', archivo);
  return this.http.post<{ mensaje: string; imagen: string }>(`${this.apiUrl}/postres/${id}/imagen`, formData);
}

/** Arma la URL completa de una imagen guardada en el backend (foto de postre) */
urlImagen(rutaRelativa: string): string {
  return `${this.apiUrl.replace(/\/api\/?$/, '')}${rutaRelativa}`;
}
}
