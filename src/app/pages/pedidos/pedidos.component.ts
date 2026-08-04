import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VentaService } from '../../services/venta.service';
import { AuthService } from '../../services/auth.service';
import { Pedido } from '../../models/venta.model';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.css']
})
export class PedidosComponent implements OnInit {
  pedidos: Pedido[] = [];
  cargando = false;
  error = '';
  procesandoId: number | null = null;
  mensajeCancelacion = '';

  // --- Subir/re-subir comprobante desde la lista de pedidos (cliente) ---
  subiendoComprobanteId: number | null = null;
  errorComprobantePorPedido: Record<number, string> = {};

  constructor(private ventaService: VentaService, private authService: AuthService) {}

  ngOnInit(): void {
    this.cargarPedidos();
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

  confirmarPago(pedido: Pedido): void {
    if (!confirm(`¿Confirmar el pago del pedido #${pedido.id_venta}? Esta acción no se puede deshacer.`)) return;

    this.procesandoId = pedido.id_venta;
    this.ventaService.confirmarPago(pedido.id_venta).subscribe({
      next: () => {
        this.procesandoId = null;
        this.cargarPedidos();
      },
      error: (err) => {
        this.procesandoId = null;
        alert(err.error?.message || 'No se pudo confirmar el pago.');
      }
    });
  }

  cancelarPedido(pedido: Pedido): void {
    if (!confirm(`¿Cancelar el pedido #${pedido.id_venta}?`)) return;

    this.mensajeCancelacion = '';
    this.procesandoId = pedido.id_venta;
    this.ventaService.cancelarVenta(pedido.id_venta).subscribe({
      next: () => {
        this.procesandoId = null;
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

    delete this.errorComprobantePorPedido[pedido.id_venta];
    this.subiendoComprobanteId = pedido.id_venta;

    this.ventaService.subirComprobante(pedido.id_venta, archivo).subscribe({
      next: () => {
        this.subiendoComprobanteId = null;
        input.value = '';
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
    if (!confirm(`¿Eliminar el pedido cancelado #${pedido.id_venta} de la lista? Esta acción no se puede deshacer.`)) return;

    this.procesandoId = pedido.id_venta;
    this.ventaService.eliminarVentaCancelada(pedido.id_venta).subscribe({
      next: () => {
        this.procesandoId = null;
        this.cargarPedidos();
      },
      error: (err) => {
        this.procesandoId = null;
        alert(err.error?.message || 'No se pudo eliminar el pedido.');
      }
    });
  }
}
