import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EstadoVenta, Pedido, RespuestaSimple, VentaCreadaResponse, VentaPayload } from '../models/venta.model';
import { esUrlAbsoluta, urlCloudinaryOptimizada } from '../shared/imagen-urls';

/**
 * Producto dentro de un pedido (GET /api/detalles-venta/venta/:id).
 * El subtotal lo calcula la base de datos como columna generada.
 */
export interface DetallePedido {
  id_detalle: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  nombre_postre: string;
  descripcion?: string | null;
}

/** Respuesta de POST /api/ventas/:id/pagar-mercadopago */
export interface LinkPagoMercadoPago {
  status: string;
  message?: string;
  ya_pagado?: boolean;
  id_venta?: number;
  monto_total?: number;
  moneda?: string;
  link_pago?: string;
  vence_en_horas?: number;
}

/** Respuesta de POST /api/pagos/mercadopago/verificar */
export interface VerificacionPago {
  status: string;
  id_venta: number;
  estado_venta: string;
  monto_total: number;
  pagado: boolean;
}

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
   *
   * @param claveIdempotencia si se envía, el backend evita crear un pedido
   *        duplicado cuando se reintenta la misma compra (doble clic, recarga
   *        o reintento de red) y devuelve el pedido ya creado.
   */
  crearVenta(payload: VentaPayload, claveIdempotencia?: string): Observable<VentaCreadaResponse> {
    const opciones = claveIdempotencia
      ? { headers: { 'Idempotency-Key': claveIdempotencia } }
      : {};
    return this.http.post<VentaCreadaResponse>(`${this.apiUrl}/ventas`, payload, opciones);
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

  /**
   * GET /api/detalles-venta/venta/:id — productos de un pedido.
   * Permite al cliente consultar QUÉ compró y a qué precio, no solo el total.
   */
  listarDetalles(idVenta: number): Observable<DetallePedido[]> {
    return this.http.get<DetallePedido[]>(`${this.apiUrl}/detalles-venta/venta/${idVenta}`);
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

  /**
   * URL de una imagen del backend: comprobante de pago (Yape/Plin/transferencia)
   * o los QR locales de `src/assets/pagos/`.
   *
   * Los comprobantes subidos desde la app viven en Cloudinary y son capturas de
   * celular de ~1 MB que en Pedidos se muestran dentro de una miniatura de
   * 160 px. Pidiéndolas con `f_auto,q_auto,w_600,c_limit` bajan como WebP ya
   * redimensionado (y siguen siendo perfectamente legibles: son capturas).
   */
  urlImagen(ruta: string, ancho = 600): string {
    if (!ruta) return '';
    if (esUrlAbsoluta(ruta)) {
      return urlCloudinaryOptimizada(ruta, ancho);
    }
    return `${this.baseArchivos}${ruta}`;
  }
/**
   * POST /api/ventas/:id/pagar-mercadopago — genera el link de pago de
   * Mercado Pago para un pedido propio que sigue "Pendiente".
   */
  pagarMercadoPago(idVenta: number): Observable<LinkPagoMercadoPago> {
    return this.http.post<LinkPagoMercadoPago>(`${this.apiUrl}/ventas/${idVenta}/pagar-mercadopago`, {});
  }

  /**
   * POST /api/pagos/mercadopago/verificar — al volver de Mercado Pago, el
   * backend consulta el pago y confirma el pedido (respaldo del webhook).
   */
  verificarPagoMercadoPago(idVenta: number, idPago?: string | null): Observable<VerificacionPago> {
    return this.http.post<VerificacionPago>(`${this.apiUrl}/pagos/mercadopago/verificar`, {
      id_venta: idVenta,
      payment_id: idPago || undefined
    });
  }

  pagarConTarjeta(idVenta: number, tokenId: string, email?: string): Observable<RespuestaSimple & { id_cargo?: string }> {
    return this.http.post<RespuestaSimple & { id_cargo?: string }>(
      `${this.apiUrl}/ventas/${idVenta}/pagar-tarjeta`,
      { token_id: tokenId, email }
    );
  }

}
