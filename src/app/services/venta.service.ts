import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EstadoVenta, Pedido, RespuestaSimple, VentaCreadaResponse, VentaPayload } from '../models/venta.model';

@Injectable({
  providedIn: 'root'
})
export class VentaService {
  private apiUrl = environment.apiUrl;

  /** Base sin '/api', para armar la URL de imágenes servidas como estáticas (comprobantes, QR) */
  get baseArchivos(): string {
    return this.apiUrl.replace(/\/api\/?$/, '');
  }

  constructor(private http: HttpClient) {}

  /**
   * POST /api/ventas — requiere token (rol admin o cliente, ver soloVentas).
   * Crea el pedido y agrega todos los productos en una sola llamada.
   * Si metodoPago es 'Yape/Plin' el pedido queda en estado 'Pendiente'
   * hasta que se suba el comprobante y el admin lo confirme.
   */
  crearVenta(payload: VentaPayload): Observable<VentaCreadaResponse> {
    return this.http.post<VentaCreadaResponse>(`${this.apiUrl}/ventas`, payload);
  }

  /**
   * GET /api/ventas — requiere token.
   * Si el usuario logueado es 'cliente' el backend ya filtra y solo trae SUS pedidos.
   * Si es 'admin' trae todos. `estado` es opcional: 'Pendiente' | 'Completada' | 'Anulada'.
   */
  listarVentas(estado?: EstadoVenta): Observable<Pedido[]> {
    const query = estado ? `?estado=${estado}` : '';
    return this.http.get<Pedido[]>(`${this.apiUrl}/ventas${query}`);
  }

  /** POST /api/ventas/:id/comprobante — sube la foto de pago de Yape/Plin (multipart) */
  subirComprobante(idVenta: number, archivo: File): Observable<RespuestaSimple & { comprobante_pago: string }> {
    const formData = new FormData();
    formData.append('comprobante', archivo);
    return this.http.post<RespuestaSimple & { comprobante_pago: string }>(
      `${this.apiUrl}/ventas/${idVenta}/comprobante`,
      formData
    );
  }

  /** PUT /api/ventas/:id/confirmar-pago — solo admin. No se puede deshacer. */
  confirmarPago(idVenta: number): Observable<RespuestaSimple> {
    return this.http.put<RespuestaSimple>(`${this.apiUrl}/ventas/${idVenta}/confirmar-pago`, {});
  }

  /** DELETE /api/ventas/:id — cancela un pedido propio mientras siga "Pendiente" */
  cancelarVenta(idVenta: number): Observable<RespuestaSimple> {
    return this.http.delete<RespuestaSimple>(`${this.apiUrl}/ventas/${idVenta}`);
  }

  /**
   * DELETE /api/ventas/:id/eliminar-cancelado — solo admin.
   * Borra definitivamente de la pantalla un pedido que ya está en estado
   * "Cancelada" (por el cliente, por el admin, o automáticamente por
   * falta de confirmación de pago).
   */
  eliminarVentaCancelada(idVenta: number): Observable<RespuestaSimple> {
    return this.http.delete<RespuestaSimple>(`${this.apiUrl}/ventas/${idVenta}/eliminar-cancelado`);
  }

  /** Arma la URL completa de una imagen guardada en el backend (comprobante o QR) */
  urlImagen(rutaRelativa: string): string {
    return `${this.baseArchivos}${rutaRelativa}`;
  }
}
