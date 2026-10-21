import { Postre } from './catalogo.model';

/** Debe coincidir con el ENUM metodo_pago de la tabla Venta */
export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Yape' | 'Plin';

export interface ItemCarrito {
  postre: Postre;
  cantidad: number;
}

export interface ProductoVentaPayload {
  id_postre: number;
  cantidad: number;
}

/**
 * Body de POST /api/ventas.
 * El id_usuario NO se envía: venta.controller.js lo toma de req.usuario
 * (inyectado por verificarToken a partir del JWT). Este endpoint crea la
 * venta y sus detalles en un solo paso (llama sp_RegistrarVenta y luego
 * sp_AgregarDetalleVenta por cada producto).
 */
export interface VentaPayload {
  id_cliente: number | null;
  tipo_comprobante: 'Boleta' | 'Factura' | 'Nota de Venta';
  metodo_pago: MetodoPago;
  productos: ProductoVentaPayload[];
  /**
   * Dirección de entrega tomada del perfil del cliente.
   * Se COPIA al pedido (no queda como referencia): si el cliente cambia su
   * domicilio más adelante, el pedido antiguo sigue mostrando dónde se entregó.
   */
  direccion_entrega?: string | null;
  latitud_entrega?: number | null;
  longitud_entrega?: number | null;
}

export interface VentaCreadaResponse {
  status: string;
  message: string;
  data: {
    id_venta: number;
    monto_total: number;
    metodo_pago: string;
    estado_venta?: EstadoVenta;
    fecha: string;
  };
}

/**
 * Debe coincidir con el ENUM estado_venta de la tabla Venta.
 * El backend (venta.controller.js) usa 'Cancelada' al cancelar un pedido
 * (manual o automáticamente por falta de confirmación de pago).
 * Se deja 'Anulada' también por compatibilidad con datos antiguos.
 */
export type EstadoVenta = 'Pendiente' | 'Completada' | 'Cancelada' | 'Anulada';

/** Fila que devuelve GET /api/ventas (lista de pedidos) */
export interface Pedido {
  id_venta: number;
  fecha_hora: string;
  monto_total: number;
  metodo_pago: MetodoPago;
  comprobante_pago: string | null;
  tipo_comprobante: string;
  estado_venta: EstadoVenta;
  cliente: string;
  atendido_por: string;
  /** Dónde se entrega el pedido, copiado del perfil al momento de comprar. */
  direccion_entrega?: string | null;
  latitud_entrega?: number | null;
  longitud_entrega?: number | null;
  /** Estado del delivery: 'En camino' | 'Entregado' | null (aún no salió). */
  estado_entrega?: 'En camino' | 'Entregado' | null;
  /** Teléfono del cliente, para que el repartidor pueda llamarlo. */
  telefono_cliente?: string | null;
}

export interface RespuestaSimple {
  status: string;
  message: string;
}
