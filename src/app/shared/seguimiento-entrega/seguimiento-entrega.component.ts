import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import type * as Leaflet from 'leaflet';

import { Seguimiento, SeguimientoService } from '../../services/seguimiento.service';
import { IconoComponent } from '../icono/icono.component';

/** Cada cuánto el cliente consulta por dónde va el delivery. */
const SEGUNDOS_CONSULTA = 5;
/** Cada cuánto el admin manda su posición mientras comparte su ubicación. */
const SEGUNDOS_ENVIO = 5;

/**
 * Mapa de seguimiento de una entrega (OpenStreetMap + Leaflet).
 *
 * - modo "cliente": solo mira. Dibuja la ruta que marcó el admin, el punto de
 *   entrega y el punto donde va el delivery, y se actualiza solo.
 * - modo "admin": además marca el punto de partida (su ubicación o un clic en
 *   el mapa), inicia la entrega, comparte su posición en vivo y la finaliza.
 *
 * El admin debe dejar esta pantalla abierta (idealmente en el celular con el
 * que reparte) mientras comparte su ubicación: el navegador es quien la envía.
 */
@Component({
  selector: 'app-seguimiento-entrega',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seguimiento-entrega.component.html',
  styleUrls: ['./seguimiento-entrega.component.css']
})
export class SeguimientoEntregaComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) idVenta!: number;
  @Input() modo: 'cliente' | 'admin' = 'cliente';

  @ViewChild('contenedor', { static: true }) contenedor!: ElementRef<HTMLDivElement>;

  private L: typeof Leaflet | null = null;
  private mapa?: Leaflet.Map;
  private capaRuta?: Leaflet.Polyline;
  private marcadorDestino?: Leaflet.Marker;
  private marcadorDelivery?: Leaflet.Marker;
  private marcadorInicio?: Leaflet.Marker;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private idWatch: number | null = null;
  private ultimoEnvio = 0;
  private destruido = false;
  private rutaDibujada = false;
  private eligiendoInicio = false;

  seguimiento: Seguimiento | null = null;
  cargando = true;
  error = '';
  mensaje = '';
  ocupado = false;
  compartiendo = false;
  /** Punto de partida elegido por el admin antes de iniciar. */
  inicio: { latitud: number; longitud: number } | null = null;
  marcandoInicio = false;

  constructor(
    private seguimientoService: SeguimientoService,
    private cd: ChangeDetectorRef
  ) {}

  get esAdmin(): boolean {
    return this.modo === 'admin';
  }

  get enCamino(): boolean {
    return this.seguimiento?.estado === 'En camino';
  }

  get entregado(): boolean {
    return this.seguimiento?.estado === 'Entregado';
  }

  get sinIniciar(): boolean {
    return !this.seguimiento || this.seguimiento.estado === 'Sin iniciar';
  }

  /** Texto "Aprox. 12 min · a 3.4 km". */
  get resumen(): string {
    const s = this.seguimiento;
    if (!s || !this.enCamino || s.distancia_restante_m == null) return '';
    const km = s.distancia_restante_m >= 1000
      ? `${(s.distancia_restante_m / 1000).toFixed(1)} km`
      : `${s.distancia_restante_m} m`;
    const min = s.eta_segundos != null ? Math.max(1, Math.round(s.eta_segundos / 60)) : null;
    return min !== null ? `Llega en aprox. ${min} min · a ${km}` : `A ${km} de tu dirección`;
  }

  get desactualizado(): boolean {
    return this.enCamino && (this.seguimiento?.segundos_sin_actualizar ?? 0) > 90;
  }

  get minutosSinActualizar(): number {
    return Math.round((this.seguimiento?.segundos_sin_actualizar ?? 0) / 60);
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const modulo = (await import('leaflet')) as unknown as { default?: typeof Leaflet };
      this.L = (modulo.default ?? modulo) as typeof Leaflet;
      if (this.destruido) return;

      this.mapa = this.L.map(this.contenedor.nativeElement, {
        center: [-12.0464, -77.0428],
        zoom: 13,
        scrollWheelZoom: false
      });
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.mapa);

      this.mapa.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (this.esAdmin && this.eligiendoInicio) {
          this.fijarInicio(e.latlng.lat, e.latlng.lng);
          this.eligiendoInicio = false;
          this.marcandoInicio = false;
          this.cd.markForCheck();
        }
      });

      await this.consultar(true);
    } catch (e) {
      console.error('No se pudo cargar el mapa de seguimiento:', e);
      this.error = 'No se pudo cargar el mapa.';
      this.cargando = false;
      this.cd.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.detenerComparticion();
    this.mapa?.remove();
    this.mapa = undefined;
  }

  // --------------------------------------------------------------------------
  // Consulta periódica (cliente y admin)
  // --------------------------------------------------------------------------
  private consultar(conRuta: boolean): Promise<void> {
    return new Promise((resolver) => {
      this.seguimientoService.obtener(this.idVenta, conRuta || !this.rutaDibujada).subscribe({
        next: (s) => {
          if (this.destruido) return resolver();
          this.seguimiento = s;
          this.cargando = false;
          this.error = '';
          this.dibujar(s);
          this.programarSiguiente();
          this.cd.markForCheck();
          resolver();
        },
        error: (err) => {
          if (this.destruido) return resolver();
          this.cargando = false;
          this.error = err.error?.message || err.error?.error || 'No se pudo consultar el seguimiento.';
          this.programarSiguiente(15);
          this.cd.markForCheck();
          resolver();
        }
      });
    });
  }

  private programarSiguiente(segundos = SEGUNDOS_CONSULTA): void {
    if (this.destruido) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    // Entregado: ya no hay nada que actualizar.
    if (this.entregado) return;
    this.temporizador = setTimeout(() => this.consultar(false), segundos * 1000);
  }

  // --------------------------------------------------------------------------
  // Dibujo del mapa
  // --------------------------------------------------------------------------
  private dibujar(s: Seguimiento): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;

    // Punto de entrega
    if (s.destino && !this.marcadorDestino) {
      this.marcadorDestino = L.marker([s.destino.latitud, s.destino.longitud], {
        icon: this.icono('destino'),
        title: 'Punto de entrega'
      }).addTo(mapa);
      if (this.sinIniciar) mapa.setView([s.destino.latitud, s.destino.longitud], 15);
    }

    // Ruta (viene solo la primera vez)
    if (s.ruta && s.ruta.length > 1) {
      this.capaRuta?.remove();
      this.capaRuta = L.polyline(s.ruta, { color: '#C2416B', weight: 5, opacity: 0.85 }).addTo(mapa);
      this.rutaDibujada = true;
      mapa.fitBounds(this.capaRuta.getBounds(), { padding: [30, 30] });
    }

    // Delivery
    if (s.actual && (this.enCamino || this.entregado)) {
      const pos: Leaflet.LatLngTuple = [s.actual.latitud, s.actual.longitud];
      if (!this.marcadorDelivery) {
        this.marcadorDelivery = L.marker(pos, { icon: this.icono('delivery'), title: 'Tu pedido', zIndexOffset: 1000 }).addTo(mapa);
      } else {
        this.marcadorDelivery.setLatLng(pos);
      }
    }

    if (this.entregado) {
      this.marcadorDelivery?.remove();
      this.marcadorDelivery = undefined;
    }
  }

  private icono(tipo: 'destino' | 'delivery' | 'inicio'): Leaflet.DivIcon {
    const L = this.L!;
    if (tipo === 'delivery') {
      return L.divIcon({
        className: 'seg-icono',
        html: '<div style="width:38px;height:38px;border-radius:50%;background:#fff;border:3px solid #C2416B;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 6px rgba(0,0,0,.35)" aria-hidden="true">🛵</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
    }
    const color = tipo === 'destino' ? '#C2416B' : '#2E7D4F';
    return L.divIcon({
      className: 'seg-icono',
      html:
        '<svg width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">' +
        `<path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 27 15 27s15-16 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>` +
        '<circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  }

  // --------------------------------------------------------------------------
  // Acciones del admin
  // --------------------------------------------------------------------------
  usarMiUbicacionComoInicio(): void {
    this.mensaje = '';
    if (!('geolocation' in navigator)) {
      this.mensaje = 'Tu navegador no puede darnos tu ubicación. Marca el inicio en el mapa.';
      return;
    }
    this.ocupado = true;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.ocupado = false;
        this.fijarInicio(p.coords.latitude, p.coords.longitude);
        this.mapa?.setView([p.coords.latitude, p.coords.longitude], 15);
        this.cd.markForCheck();
      },
      () => {
        this.ocupado = false;
        this.mensaje = 'No pudimos obtener tu ubicación (revisa el permiso del navegador). Marca el inicio en el mapa.';
        this.cd.markForCheck();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }

  /** Activa el modo "toca el mapa para marcar dónde sales". */
  marcarInicioEnMapa(): void {
    this.mensaje = 'Toca el mapa para marcar el punto de salida.';
    this.eligiendoInicio = true;
    this.marcandoInicio = true;
  }

  private fijarInicio(latitud: number, longitud: number): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;
    this.inicio = { latitud, longitud };
    this.mensaje = '';
    if (!this.marcadorInicio) {
      this.marcadorInicio = L.marker([latitud, longitud], {
        icon: this.icono('inicio'),
        draggable: true,
        title: 'Punto de salida (arrástralo para moverlo)'
      }).addTo(mapa);
      this.marcadorInicio.on('dragend', () => {
        const p = this.marcadorInicio?.getLatLng();
        if (p) {
          this.inicio = { latitud: p.lat, longitud: p.lng };
          this.cd.markForCheck();
        }
      });
    } else {
      this.marcadorInicio.setLatLng([latitud, longitud]);
    }
  }

  iniciarEntrega(): void {
    if (!this.inicio) {
      this.mensaje = 'Primero marca el punto de salida.';
      return;
    }
    this.ocupado = true;
    this.mensaje = '';
    this.seguimientoService.iniciar(this.idVenta, this.inicio.latitud, this.inicio.longitud).subscribe({
      next: async (resp) => {
        this.ocupado = false;
        this.marcadorInicio?.remove();
        this.marcadorInicio = undefined;
        this.inicio = null;
        this.rutaDibujada = false;
        this.mensaje = resp.ruta_aproximada
          ? 'Entrega iniciada. No se pudo trazar por calles: se muestra una línea recta.'
          : 'Entrega iniciada. El cliente ya ve la ruta.';
        await this.consultar(true);
        this.iniciarComparticion();
        this.cd.markForCheck();
      },
      error: (err) => {
        this.ocupado = false;
        this.mensaje = err.error?.message || 'No se pudo iniciar la entrega.';
        this.cd.markForCheck();
      }
    });
  }

  /** Empieza a enviar la posición del navegador cada pocos segundos. */
  iniciarComparticion(): void {
    if (this.idWatch !== null) return;
    if (!('geolocation' in navigator)) {
      this.mensaje = 'Tu navegador no puede compartir la ubicación en vivo.';
      return;
    }
    this.compartiendo = true;
    this.idWatch = navigator.geolocation.watchPosition(
      (p) => {
        const ahora = Date.now();
        if (ahora - this.ultimoEnvio < SEGUNDOS_ENVIO * 1000) return;
        this.ultimoEnvio = ahora;
        this.seguimientoService.enviarPosicion(this.idVenta, p.coords.latitude, p.coords.longitude).subscribe({
          error: () => {
            /* un envío perdido no importa: llega el siguiente */
          }
        });
      },
      () => {
        this.mensaje = 'No se pudo leer tu ubicación. Revisa el permiso del navegador.';
        this.detenerComparticion();
        this.cd.markForCheck();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    this.cd.markForCheck();
  }

  detenerComparticion(): void {
    if (this.idWatch !== null) {
      navigator.geolocation.clearWatch(this.idWatch);
      this.idWatch = null;
    }
    this.compartiendo = false;
    this.cd.markForCheck();
  }

  alternarComparticion(): void {
    if (this.compartiendo) this.detenerComparticion();
    else this.iniciarComparticion();
  }

  /** Recalcula la ruta desde donde estás ahora (por si te desviaste). */
  recalcularDesdeAqui(): void {
    this.usarMiUbicacionComoInicio();
    // Tras fijar el inicio con la ubicación actual, el admin pulsa "Iniciar entrega".
  }

  finalizarEntrega(): void {
    this.ocupado = true;
    this.seguimientoService.finalizar(this.idVenta).subscribe({
      next: async () => {
        this.ocupado = false;
        this.detenerComparticion();
        this.mensaje = 'Entrega marcada como entregada.';
        await this.consultar(false);
        this.cd.markForCheck();
      },
      error: (err) => {
        this.ocupado = false;
        this.mensaje = err.error?.message || 'No se pudo finalizar la entrega.';
        this.cd.markForCheck();
      }
    });
  }
}
