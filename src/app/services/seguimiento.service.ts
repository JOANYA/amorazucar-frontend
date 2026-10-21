import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PuntoMapa {
  latitud: number;
  longitud: number;
}

/** Respuesta de GET /api/seguimiento/:idVenta */
export interface Seguimiento {
  status: string;
  /** 'Sin iniciar' mientras el admin no marque la salida. */
  estado: 'Sin iniciar' | 'En camino' | 'Entregado';
  origen?: PuntoMapa | null;
  actual?: PuntoMapa | null;
  destino: (PuntoMapa & { direccion?: string | null }) | null;
  distancia_total_m?: number | null;
  distancia_restante_m?: number | null;
  eta_segundos?: number | null;
  segundos_sin_actualizar?: number | null;
  /** Trazo de la ruta como [lat, lng]; solo viene con ?ruta=1 */
  ruta?: [number, number][];
}

/**
 * Seguimiento del delivery en vivo.
 * - Admin: inicia la entrega (marca la salida), manda su posición y la finaliza.
 * - Cliente: consulta la ruta y por dónde va el pedido.
 */
@Injectable({ providedIn: 'root' })
export class SeguimientoService {
  private apiUrl = `${environment.apiUrl}/seguimiento`;

  constructor(private http: HttpClient) {}

  obtener(idVenta: number, conRuta = false): Observable<Seguimiento> {
    return this.http.get<Seguimiento>(`${this.apiUrl}/${idVenta}${conRuta ? '?ruta=1' : ''}`);
  }

  iniciar(idVenta: number, latitud: number, longitud: number): Observable<{ status: string; message: string; ruta_aproximada?: boolean }> {
    return this.http.post<{ status: string; message: string; ruta_aproximada?: boolean }>(
      `${this.apiUrl}/${idVenta}/iniciar`,
      { latitud, longitud }
    );
  }

  enviarPosicion(idVenta: number, latitud: number, longitud: number): Observable<{ status: string }> {
    return this.http.put<{ status: string }>(`${this.apiUrl}/${idVenta}/posicion`, { latitud, longitud });
  }

  finalizar(idVenta: number): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.apiUrl}/${idVenta}/finalizar`, {});
  }
}
