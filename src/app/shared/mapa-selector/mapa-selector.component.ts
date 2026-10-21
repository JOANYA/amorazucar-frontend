import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import type * as Leaflet from 'leaflet';

import { PerfilService } from '../../services/perfil.service';
import { DireccionCandidata } from '../../models/perfil.model';
import { IconoComponent } from '../icono/icono.component';

/** Centro por defecto: la pastelería entrega en Lima. */
const LIMA: [number, number] = [-12.0464, -77.0428];

/**
 * Selector de ubicación sobre OpenStreetMap.
 *
 * Notas de implementación (todas con motivo):
 *
 * 1. Leaflet se carga con `import('leaflet')` DENTRO de ngAfterViewInit, no en
 *    el `import` de arriba. Es una librería de ~150 KB que solo se necesita en
 *    las pantallas que muestran un mapa; así no entra en el paquete inicial y
 *    tampoco revienta en un entorno sin DOM.
 * 2. El pin es un `divIcon` con un SVG propio, no la imagen por defecto de
 *    Leaflet: esas imágenes se resuelven por ruta relativa al CSS y suelen
 *    romperse cuando el empaquetador las mueve. Un SVG dibujado aquí no
 *    depende de ninguna ruta de assets y además queda del color de la marca.
 * 3. La dirección NO se pide mientras se arrastra el pin. La política de uso
 *    de Nominatim prohíbe ese uso; solo se consulta al soltar el pin, al hacer
 *    clic en el mapa o al pulsar "Usar mi ubicación".
 */
@Component({
  selector: 'app-mapa-selector',
  standalone: true,
  imports: [IconoComponent],
  templateUrl: './mapa-selector.component.html',
  styleUrls: ['./mapa-selector.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapaSelectorComponent implements AfterViewInit, OnDestroy {
  /** Punto inicial. Si es null, el mapa abre centrado en Lima sin pin. */
  @Input() latitud: number | null = null;
  @Input() longitud: number | null = null;
  /** Punto donde se centra el mapa cuando el cliente todavía no marcó ninguno. */
  @Input() zoom = 14;

  /** El cliente movió el pin (clic en el mapa o arrastre). */
  @Output() ubicacionCambiada = new EventEmitter<{ latitud: number; longitud: number }>();
  /** El mapa resolvió una dirección para el punto (texto sugerido). */
  @Output() direccionDetectada = new EventEmitter<string>();

  @ViewChild('contenedor', { static: true }) contenedor!: ElementRef<HTMLDivElement>;

  private leaflet: typeof Leaflet | null = null;
  private mapa?: Leaflet.Map;
  private marcador?: Leaflet.Marker;
  private vistaInicializada = false;

  listo = false;
  cargandoMapa = true;
  buscando = false;
  ubicando = false;
  mensaje = '';
  errorMapa = '';
  resultados: DireccionCandidata[] = [];
  coordenadasTexto = '';

  constructor(
    private perfilService: PerfilService,
    private cd: ChangeDetectorRef
  ) {}

  async ngAfterViewInit(): Promise<void> {
    try {
      const modulo = (await import('leaflet')) as unknown as { default?: typeof Leaflet };
      const L = (modulo.default ?? modulo) as typeof Leaflet;
      this.leaflet = L;

      const centro: [number, number] =
        this.latitud !== null && this.longitud !== null
          ? [this.latitud, this.longitud]
          : LIMA;

      this.mapa = L.map(this.contenedor.nativeElement, {
        center: centro,
        zoom: this.latitud !== null ? 16 : this.zoom,
        scrollWheelZoom: false // la rueda sigue sirviendo para hacer scroll en la página
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // Atribución obligatoria de la política de uso de los tiles de OSM.
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.mapa);

      // Clic en el mapa: coloca (o mueve) el pin donde el cliente tocó.
      this.mapa.on('click', (evento: Leaflet.LeafletMouseEvent) => {
        this.colocarPin(evento.latlng.lat, evento.latlng.lng, true);
      });

      if (this.latitud !== null && this.longitud !== null) {
        this.colocarPin(this.latitud, this.longitud, false);
      }
      this.vistaInicializada = true;

      this.cargandoMapa = false;
      this.listo = true;
      this.cd.markForCheck();
    } catch (error) {
      console.error('No se pudo cargar el mapa:', error);
      this.cargandoMapa = false;
      this.errorMapa =
        'No se pudo cargar el mapa. Puedes escribir tu dirección igual: se guardará con el texto.';
      this.cd.markForCheck();
    }
  }

  ngOnDestroy(): void {
    // Leaflet deja listeners de ventana y temporizadores si no se destruye.
    this.mapa?.remove();
    this.mapa = undefined;
    this.marcador = undefined;
  }

  /**
   * Crea o mueve el pin.
   * @param pedirDireccion true cuando el movimiento lo hizo el cliente (ahí sí
   *        tiene sentido consultar la dirección del punto).
   */
  private colocarPin(latitud: number, longitud: number, pedirDireccion: boolean): void {
    const L = this.leaflet;
    if (!L || !this.mapa) return;

    const posicion: Leaflet.LatLngTuple = [latitud, longitud];

    if (!this.marcador) {
      this.marcador = L.marker(posicion, {
        draggable: true,
        icon: this.crearIcono(),
        keyboard: true,
        title: 'Tu ubicación de entrega'
      });

      // Solo al SOLTAR el pin se pide la dirección (política de Nominatim).
      this.marcador.on('dragend', () => {
        const punto = this.marcador?.getLatLng();
        if (punto) this.confirmarPunto(punto.lat, punto.lng);
      });

      this.marcador.addTo(this.mapa);
    } else {
      this.marcador.setLatLng(posicion);
    }

    this.actualizarTextoCoordenadas(latitud, longitud);
    this.ubicacionCambiada.emit({ latitud, longitud });

    if (pedirDireccion) {
      this.consultarDireccionDelPunto(latitud, longitud);
    }

    if (this.vistaInicializada && this.mapa) {
      this.mapa.panTo(posicion);
    }
    this.cd.markForCheck();
  }

  /** Emitir desde el evento de arrastre (ya dentro de la zona de Angular). */
  private confirmarPunto(latitud: number, longitud: number): void {
    this.actualizarTextoCoordenadas(latitud, longitud);
    this.ubicacionCambiada.emit({ latitud, longitud });
    this.consultarDireccionDelPunto(latitud, longitud);
    this.cd.markForCheck();
  }

  /** Pin SVG propio: no depende de rutas de assets y usa el color de la marca. */
  private crearIcono(): Leaflet.DivIcon {
    const L = this.leaflet!;
    return L.divIcon({
      className: 'pin-ubicacion',
      html:
        '<svg width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">' +
        '<path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 27 15 27s15-16 15-27C30 6.7 23.3 0 15 0z" fill="#C2416B"/>' +
        '<circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  }

  private actualizarTextoCoordenadas(latitud: number, longitud: number): void {
    this.coordenadasTexto = `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`;
  }

  /** Traduce el punto marcado a la dirección más cercana (Nominatim, vía backend). */
  private consultarDireccionDelPunto(latitud: number, longitud: number): void {
    this.mensaje = '';
    this.perfilService.direccionDelPunto(latitud, longitud).subscribe({
      next: (respuesta) => {
        if (respuesta?.etiqueta) {
          this.direccionDetectada.emit(respuesta.etiqueta);
        }
        this.cd.markForCheck();
      },
      error: () => {
        // Sin dirección automática el cliente igual puede escribirla a mano.
        this.cd.markForCheck();
      }
    });
  }

  /** Botón "Buscar": consulta el backend, que a su vez consulta a Nominatim. */
  buscar(consulta: string): void {
    const texto = (consulta ?? '').trim();
    this.resultados = [];
    this.mensaje = '';

    if (texto.length < 5) {
      this.mensaje = 'Escribe al menos 5 caracteres (por ejemplo: Av. Arequipa 1250, Lima).';
      this.cd.markForCheck();
      return;
    }

    this.buscando = true;
    this.perfilService.buscarDireccion(texto).subscribe({
      next: (resultados) => {
        this.buscando = false;
        this.resultados = resultados ?? [];
        if (this.resultados.length === 0) {
          this.mensaje = 'No encontramos esa dirección. Prueba con más detalles o marca el punto en el mapa.';
        }
        this.cd.markForCheck();
      },
      error: () => {
        this.buscando = false;
        this.mensaje = 'No se pudo buscar la dirección ahora. Marca el punto en el mapa.';
        this.cd.markForCheck();
      }
    });
  }

  /** El cliente eligió uno de los resultados de la búsqueda. */
  elegir(resultado: DireccionCandidata): void {
    this.resultados = [];
    this.mensaje = '';
    this.mapa?.setView([resultado.latitud, resultado.longitud], 16);
    this.colocarPin(resultado.latitud, resultado.longitud, false);
    // El texto que eligió el cliente es el que debe quedar en el campo.
    this.direccionDetectada.emit(resultado.etiqueta);
    this.cd.markForCheck();
  }

  /**
   * Pide la ubicación actual al navegador y pone el pin ahí.
   *
   * Requiere un contexto seguro: `http://localhost` cuenta como tal, así que
   * funciona en desarrollo; en producción obliga a servir la app por HTTPS.
   * Si el usuario niega el permiso o falla la lectura, se le dice qué hacer en
   * vez de dejarlo sin respuesta (el mapa y la búsqueda siguen disponibles).
   */
  usarMiUbicacion(): void {
    if (!('geolocation' in navigator)) {
      this.mensaje = 'Tu navegador no puede darnos tu ubicación. Marca el punto en el mapa.';
      this.cd.markForCheck();
      return;
    }

    this.ubicando = true;
    this.mensaje = '';

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        this.ubicando = false;
        const { latitude, longitude } = posicion.coords;
        this.mapa?.setView([latitude, longitude], 17);
        this.colocarPin(latitude, longitude, true);
        this.cd.markForCheck();
      },
      (error) => {
        this.ubicando = false;
        this.mensaje =
          error.code === error.PERMISSION_DENIED
            ? 'No nos diste permiso para usar tu ubicación. Puedes escribir la dirección o marcar el punto en el mapa.'
            : 'No pudimos obtener tu ubicación. Escribe la dirección o marca el punto en el mapa.';
        this.cd.markForCheck();
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }
}
