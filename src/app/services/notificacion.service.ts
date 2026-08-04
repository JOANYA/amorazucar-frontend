import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Notificacion } from '../models/notificacion.model';

/**
 * Servicio para las notificaciones del usuario logueado (pago confirmado,
 * pedido cancelado, comprobante subido, etc.).
 * Consume GET /api/notificaciones/usuario/:id_usuario y
 * PUT /api/notificaciones/:id/leer, ya existentes en el backend.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarPorUsuario(idUsuario: number): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/notificaciones/usuario/${idUsuario}`);
  }

  marcarComoLeida(idNotificacion: number): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/notificaciones/${idNotificacion}/leer`, {});
  }
}
