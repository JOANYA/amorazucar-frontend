import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VentaService } from '../../services/venta.service';
import { IconoComponent } from '../../shared/icono/icono.component';

type Fase = 'verificando' | 'pagado' | 'pendiente' | 'fallido' | 'error';

/**
 * Página a la que Mercado Pago devuelve al cliente después de pagar
 * (back_urls del link de pago): /pago/resultado?venta=ID&payment_id=...&status=...
 *
 * Confirma el pedido en el backend (que consulta el pago directamente a
 * Mercado Pago) y, cuando está pagado, redirige solo a "Mis pedidos". El
 * webhook de Mercado Pago normalmente ya lo habrá confirmado; esta verificación
 * cubre el caso en que el webhook todavía no llegó.
 */
@Component({
  selector: 'app-pago-resultado',
  standalone: true,
  imports: [CommonModule, RouterLink, IconoComponent],
  template: `
    <main class="resultado-page">
      <section class="resultado-card" aria-live="polite">
        @switch (fase) {
          @case ('verificando') {
            <div class="icono"><span class="spinner-grande"></span></div>
            <h1>Confirmando tu pago...</h1>
            <p>Estamos verificando tu pago con Mercado Pago. No cierres esta página.</p>
          }
          @case ('pagado') {
            <div class="icono ok"><app-icono nombre="CheckCircle" [tamano]="64" /></div>
            <h1>¡Pago confirmado!</h1>
            <p>Tu pedido <strong>#{{ idVenta }}</strong> ya está pagado
              @if (monto !== null) { (S/ {{ monto | number:'1.2-2' }}) }.
              ¡Gracias por tu compra!</p>
            <p class="sutil">Te llevamos a tus pedidos en {{ segundos }} s...</p>
            <a routerLink="/menu/pedidos" class="btn-principal">Ver mis pedidos</a>
          }
          @case ('pendiente') {
            <div class="icono aviso"><app-icono nombre="Hourglass" [tamano]="64" /></div>
            <h1>Tu pago está en proceso</h1>
            <p>Mercado Pago aún no confirma el pago del pedido <strong>#{{ idVenta }}</strong>.
              En cuanto lo confirme, tu pedido quedará pagado automáticamente.</p>
            <button type="button" class="btn-principal" (click)="verificar(true)">Volver a verificar</button>
            <a routerLink="/menu/pedidos" class="btn-secundario">Ir a mis pedidos</a>
          }
          @case ('fallido') {
            <div class="icono error"><app-icono nombre="XCircle" [tamano]="64" /></div>
            <h1>No se completó el pago</h1>
            <p>El pago del pedido <strong>#{{ idVenta }}</strong> no se realizó. Tu pedido sigue pendiente y puedes intentarlo otra vez.</p>
            @if (mensajeError) { <p class="error-texto">{{ mensajeError }}</p> }
            <button type="button" class="btn-principal" [disabled]="reintentando" (click)="reintentar()">
              {{ reintentando ? 'Generando link...' : 'Intentar pagar otra vez' }}
            </button>
            <a routerLink="/menu/pedidos" class="btn-secundario">Ir a mis pedidos</a>
          }
          @case ('error') {
            <div class="icono error"><app-icono nombre="WarningCircle" [tamano]="64" /></div>
            <h1>No pudimos verificar tu pago</h1>
            <p>{{ mensajeError || 'Ocurrió un problema al consultar el pago.' }}</p>
            <p class="sutil">Si ya pagaste, tu pedido se confirmará solo en unos minutos.</p>
            <button type="button" class="btn-principal" (click)="verificar(true)">Reintentar</button>
            <a routerLink="/menu/pedidos" class="btn-secundario">Ir a mis pedidos</a>
          }
        }
      </section>
    </main>
  `,
  styles: [
    `
      .resultado-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: #fff5f7;
      }
      .resultado-card {
        width: 100%;
        max-width: 460px;
        background: #fff;
        border-radius: 18px;
        padding: 2rem 1.5rem;
        text-align: center;
        box-shadow: 0 10px 30px rgba(194, 65, 107, 0.15);
      }
      h1 { font-size: 1.4rem; font-weight: 800; color: #5a2d2d; margin: 0.5rem 0; }
      p { color: #5a2d2d; margin: 0 0 0.75rem; }
      .sutil { color: #7a5a5a; font-size: 0.9rem; }
      .error-texto { color: #a8323a; font-size: 0.9rem; }
      .icono { margin-bottom: 0.5rem; }
      .icono.ok { color: #2e7d4f; }
      .icono.aviso { color: #b7791f; }
      .icono.error { color: #a8323a; }
      .btn-principal, .btn-secundario {
        display: block;
        width: 100%;
        margin-top: 0.6rem;
        padding: 0.75rem 1rem;
        border-radius: 12px;
        font-weight: 700;
        text-decoration: none;
        border: 2px solid #c2416b;
        cursor: pointer;
        font-size: 1rem;
      }
      .btn-principal { background: #c2416b; color: #fff; }
      .btn-principal:disabled { opacity: 0.6; cursor: not-allowed; }
      .btn-secundario { background: #fff; color: #a83259; }
      .spinner-grande {
        display: inline-block;
        width: 56px;
        height: 56px;
        border: 6px solid #f3c6d4;
        border-top-color: #c2416b;
        border-radius: 50%;
        animation: giro 0.9s linear infinite;
      }
      @keyframes giro { to { transform: rotate(360deg); } }
    `
  ]
})
export class PagoResultadoComponent implements OnInit, OnDestroy {
  fase: Fase = 'verificando';
  idVenta = 0;
  monto: number | null = null;
  segundos = 6;
  mensajeError = '';
  reintentando = false;

  private idPago: string | null = null;
  private estadoRetorno = '';
  private intentos = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private cuentaAtras: ReturnType<typeof setInterval> | null = null;
  private destruido = false;

  /** Cuántas veces se consulta antes de rendirse (cada 3 s => ~30 s). */
  private readonly MAX_INTENTOS = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ventaService: VentaService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.idVenta = Number(q.get('venta') || q.get('external_reference'));
    this.idPago = q.get('payment_id') || q.get('collection_id');
    this.estadoRetorno = (q.get('status') || q.get('collection_status') || '').toLowerCase();

    if (!Number.isInteger(this.idVenta) || this.idVenta <= 0) {
      this.router.navigate(['/menu/pedidos']);
      return;
    }
    this.verificar(true);
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.cuentaAtras) clearInterval(this.cuentaAtras);
  }

  verificar(reiniciar = false): void {
    if (reiniciar) {
      this.intentos = 0;
      this.fase = 'verificando';
      this.mensajeError = '';
    }
    this.ventaService.verificarPagoMercadoPago(this.idVenta, this.idPago).subscribe({
      next: (resp) => {
        if (this.destruido) return;
        this.monto = resp.monto_total ?? null;
        if (resp.pagado) {
          this.marcarPagado();
          return;
        }
        this.intentos++;
        const rechazado = ['rejected', 'cancelled', 'failure', 'null'].includes(this.estadoRetorno);
        if (rechazado) {
          this.fase = 'fallido';
        } else if (this.intentos >= this.MAX_INTENTOS) {
          this.fase = 'pendiente';
        } else {
          this.temporizador = setTimeout(() => this.verificar(), 3000);
        }
        this.cd.markForCheck();
      },
      error: (err) => {
        if (this.destruido) return;
        this.mensajeError = err.error?.message || '';
        this.fase = 'error';
        this.cd.markForCheck();
      }
    });
  }

  private marcarPagado(): void {
    this.fase = 'pagado';
    this.segundos = 6;
    this.cuentaAtras = setInterval(() => {
      this.segundos--;
      if (this.segundos <= 0) {
        if (this.cuentaAtras) clearInterval(this.cuentaAtras);
        this.router.navigate(['/menu/pedidos']);
      }
      this.cd.markForCheck();
    }, 1000);
    this.cd.markForCheck();
  }

  /** Genera un link nuevo y vuelve a Mercado Pago. */
  reintentar(): void {
    this.reintentando = true;
    this.mensajeError = '';
    this.ventaService.pagarMercadoPago(this.idVenta).subscribe({
      next: (resp) => {
        this.reintentando = false;
        if (resp.ya_pagado) {
          this.verificar(true);
        } else if (resp.link_pago) {
          window.location.href = resp.link_pago;
        }
      },
      error: (err) => {
        this.reintentando = false;
        this.mensajeError = err.error?.message || 'No se pudo generar el link de pago.';
        this.cd.markForCheck();
      }
    });
  }
}
