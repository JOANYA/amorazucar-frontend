import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VentaService, DetallePedido } from '../../services/venta.service';
import { AuthService } from '../../services/auth.service';
import { Pedido } from '../../models/venta.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { DireccionEntregaComponent } from '../../shared/direccion-entrega/direccion-entrega.component';
import { SeguimientoEntregaComponent } from '../../shared/seguimiento-entrega/seguimiento-entrega.component';

/**
 * Un solo componente para dos vistas según el rol:
 * - cliente: ve solo SUS pedidos (el backend ya filtra por id_usuario),
 *   puede cancelar mientras estén "Pendiente".
 * - admin: ve TODOS los pedidos separados en "Pendientes de pago" y
 *   "Pagados", y puede confirmar el pago de los pendientes (Yape/Plin).
 *   La confirmación es irreversible: no hay botón para desconfirmar.
 */
@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [CommonModule, RouterLink, IconoComponent, DireccionEntregaComponent, SeguimientoEntregaComponent],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.css']
})
export class PedidosComponent implements OnInit, OnDestroy {
  pedidos: Pedido[] = [];
  cargando = false;
  error = '';
  procesandoId: number | null = null;
  mensajeCancelacion = '';

  /**
   * Avisos en pantalla. Antes estas acciones usaban los diálogos nativos
   * `confirm()` y `alert()` del navegador: bloquean la interfaz, se ven
   * distintos en cada navegador y no permiten dar estilo ni ser leídos bien
   * por un lector de pantalla. Ahora se muestra un aviso propio.
   */
  mensajeExito = '';
  mensajeError = '';

  /** Confirmación en línea: guarda la acción pendiente de confirmar. */
  confirmacionPendiente: { accion: 'confirmar-pago' | 'cancelar' | 'eliminar'; idVenta: number } | null = null;

  /**
   * Productos de cada pedido, cargados bajo demanda al pulsar "Ver productos".
   * El backend ya tenía GET /api/detalles-venta/venta/:id, pero el frontend
   * nunca lo usaba: solo se veía el total, no qué se había comprado.
   */
  detallesPorPedido: Record<number, DetallePedido[] | undefined> = {};
  detalleAbierto: number | null = null;
  cargandoDetalle: number | null = null;
  errorDetalle: Record<number, string> = {};

  // --- Subir/re-subir comprobante desde la lista de pedidos (cliente) ---
  subiendoComprobanteId: number | null = null;
  errorComprobantePorPedido: Record<number, string> = {};

  // --- Pago con Mercado Pago (pedidos con Tarjeta todavía pendientes) ---
  generandoLinkId: number | null = null;

  // --- Seguimiento del delivery: pedido cuyo mapa está desplegado ---
  seguimientoAbierto: number | null = null;

  private refresco: ReturnType<typeof setInterval> | null = null;

  constructor(private ventaService: VentaService, private authService: AuthService) {}

  ngOnInit(): void {
    this.cargarPedidos();
    // El cliente ve sin recargar cuándo se confirma su pago y cuándo sale su pedido.
    if (!this.esAdmin) {
      this.refresco = setInterval(() => this.refrescarEnSilencio(), 15000);
    }
  }

  ngOnDestroy(): void {
    if (this.refresco) clearInterval(this.refresco);
  }

  /** Recarga la lista sin parpadeo ni mensajes de "Cargando...". */
  private refrescarEnSilencio(): void {
    this.ventaService.listarVentas().subscribe({
      next: (data) => (this.pedidos = data),
      error: () => {
        /* se reintenta en el siguiente ciclo */
      }
    });
  }

  /** ¿El pedido tiene un punto de entrega marcado en el mapa? */
  tieneUbicacion(pedido: Pedido): boolean {
    return pedido.latitud_entrega != null && pedido.longitud_entrega != null;
  }

  alternarSeguimiento(idVenta: number): void {
    this.seguimientoAbierto = this.seguimientoAbierto === idVenta ? null : idVenta;
  }

  /** Genera el link de Mercado Pago del pedido y lleva al cliente a pagar. */
  pagarConMercadoPago(pedido: Pedido): void {
    this.limpiarAvisos();
    this.generandoLinkId = pedido.id_venta;
    this.ventaService.pagarMercadoPago(pedido.id_venta).subscribe({
      next: (resp) => {
        this.generandoLinkId = null;
        if (resp.ya_pagado) {
          this.mensajeExito = `El pedido #${pedido.id_venta} ya estaba pagado.`;
          this.cargarPedidos();
        } else if (resp.link_pago) {
          window.location.href = resp.link_pago;
        }
      },
      error: (err) => {
        this.generandoLinkId = null;
        this.mensajeError = err.error?.message || 'No se pudo generar el link de pago.';
      }
    });
  }

  get esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  get pendientes(): Pedido[] {
    return this.pedidos.filter((p) => p.estado_venta === 'Pendiente');
  }

  get pagados(): Pedido[] {
    return this.pedidos.filter((p) => p.estado_venta === 'Completada');
  }

  /** Pedidos cancelados (manual o automáticamente). Solo se usa en la vista admin. */
  get cancelados(): Pedido[] {
    return this.pedidos.filter((p) => this.esCancelado(p));
  }

  esCancelado(pedido: Pedido): boolean {
    return pedido.estado_venta === 'Cancelada' || pedido.estado_venta === 'Anulada';
  }

  cargarPedidos(): void {
    this.cargando = true;
    this.error = '';
    this.ventaService.listarVentas().subscribe({
      next: (data) => {
        this.pedidos = data;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los pedidos.';
        this.cargando = false;
      }
    });
  }

  urlComprobante(ruta: string | null): string {
    return ruta ? this.ventaService.urlImagen(ruta) : '';
  }

  // --- Confirmación en línea (reemplaza a confirm()) ---

  /** ¿Este pedido está esperando que el usuario confirme la acción? */
  estaConfirmando(idVenta: number, accion: 'confirmar-pago' | 'cancelar' | 'eliminar'): boolean {
    return (
      this.confirmacionPendiente?.idVenta === idVenta &&
      this.confirmacionPendiente?.accion === accion
    );
  }

  pedirConfirmacion(idVenta: number, accion: 'confirmar-pago' | 'cancelar' | 'eliminar'): void {
    this.limpiarAvisos();
    this.confirmacionPendiente = { accion, idVenta };
  }

  cancelarConfirmacion(): void {
    this.confirmacionPendiente = null;
  }

  /** Ejecuta la acción que estaba pendiente de confirmación. */
  ejecutarConfirmacion(): void {
    const c = this.confirmacionPendiente;
    if (!c) return;
    this.confirmacionPendiente = null;

    if (c.accion === 'confirmar-pago') {
      this.confirmarPagoPorId(c.idVenta);
    } else if (c.accion === 'cancelar') {
      this.cancelarPedidoPorId(c.idVenta);
    } else {
      this.eliminarCanceladoPorId(c.idVenta);
    }
  }

  private limpiarAvisos(): void {
    this.mensajeExito = '';
    this.mensajeError = '';
    this.mensajeCancelacion = '';
  }

  // --- Detalle de productos del pedido (consulta del pedido) ---

  /** Muestra u oculta los productos de un pedido (los pide la primera vez). */
  alternarDetalle(idVenta: number): void {
    if (this.detalleAbierto === idVenta) {
      this.detalleAbierto = null;
      return;
    }

    this.detalleAbierto = idVenta;

    // Si ya se cargaron antes, no se vuelve a pedir.
    if (this.detallesPorPedido[idVenta]) return;

    this.cargandoDetalle = idVenta;
    delete this.errorDetalle[idVenta];

    this.ventaService.listarDetalles(idVenta).subscribe({
      next: (detalles) => {
        this.detallesPorPedido[idVenta] = detalles;
        this.cargandoDetalle = null;
      },
      error: (err) => {
        this.cargandoDetalle = null;
        this.errorDetalle[idVenta] =
          err.error?.message || 'No se pudieron cargar los productos de este pedido.';
      }
    });
  }

  /** Suma de las líneas del pedido, para comprobar que cuadra con el total. */
  totalDetalle(idVenta: number): number {
    return (this.detallesPorPedido[idVenta] ?? []).reduce(
      (acc, d) => acc + Number(d.subtotal),
      0
    );
  }

  confirmarPago(pedido: Pedido): void {
    this.pedirConfirmacion(pedido.id_venta, 'confirmar-pago');
  }

  private confirmarPagoPorId(idVenta: number): void {
    this.procesandoId = idVenta;
    this.ventaService.confirmarPago(idVenta).subscribe({
      next: () => {
        this.procesandoId = null;
        this.mensajeExito = `Pago del pedido #${idVenta} confirmado correctamente.`;
        this.cargarPedidos();
      },
      error: (err) => {
        this.procesandoId = null;
        this.mensajeError = err.error?.message || 'No se pudo confirmar el pago.';
      }
    });
  }

  cancelarPedido(pedido: Pedido): void {
    this.pedirConfirmacion(pedido.id_venta, 'cancelar');
  }

  private cancelarPedidoPorId(idVenta: number): void {
    this.procesandoId = idVenta;
    this.ventaService.cancelarVenta(idVenta).subscribe({
      next: () => {
        this.procesandoId = null;
        this.mensajeExito = `Pedido #${idVenta} cancelado. El stock fue devuelto.`;
        this.cargarPedidos();
      },
      error: (err) => {
        this.procesandoId = null;
        // Si ya estaba pagado, el backend responde con el mensaje pidiendo contactar por WhatsApp.
        this.mensajeCancelacion = err.error?.message || 'No se pudo cancelar el pedido.';
      }
    });
  }

  /**
   * Permite al cliente subir (o volver a subir) la foto del comprobante
   * directamente desde su lista de pedidos, sin depender del paso único
   * que aparecía justo después de comprar. Útil si al pagar se le olvidó
   * adjuntarla o si necesita reemplazarla.
   */
  seleccionarComprobantePedido(event: Event, pedido: Pedido): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.limpiarAvisos();
    delete this.errorComprobantePorPedido[pedido.id_venta];
    this.subiendoComprobanteId = pedido.id_venta;

    this.ventaService.subirComprobante(pedido.id_venta, archivo).subscribe({
      next: () => {
        this.subiendoComprobanteId = null;
        input.value = '';
        this.mensajeExito = `Comprobante del pedido #${pedido.id_venta} subido. Queda pendiente de confirmación.`;
        this.cargarPedidos();
      },
      error: (err) => {
        this.subiendoComprobanteId = null;
        input.value = '';
        this.errorComprobantePorPedido[pedido.id_venta] =
          err.error?.message || 'No se pudo subir el comprobante.';
      }
    });
  }

  /** Solo admin: borra de la pantalla un pedido ya cancelado. */
  eliminarCancelado(pedido: Pedido): void {
    this.pedirConfirmacion(pedido.id_venta, 'eliminar');
  }

  private eliminarCanceladoPorId(idVenta: number): void {
    this.procesandoId = idVenta;
    this.ventaService.eliminarVentaCancelada(idVenta).subscribe({
      next: () => {
        this.procesandoId = null;
        this.mensajeExito = 'Pedido eliminado de la lista.';
        this.cargarPedidos();
      },
      error: (err) => {
        this.procesandoId = null;
        this.mensajeError = err.error?.message || 'No se pudo eliminar el pedido.';
      }
    });
  }
}
