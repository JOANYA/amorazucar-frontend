import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconoComponent } from '../icono/icono.component';
import { enlaceMapa } from '../ubicacion-urls';

/**
 * Dirección de entrega de un pedido, con enlace al mapa cuando hay coordenadas.
 *
 * Es un componente aparte porque Pedidos muestra la misma información en cuatro
 * bloques distintos (pendientes, pagados, cancelados y la vista del cliente);
 * repetir el bloque en cada uno garantizaba que se desincronizaran.
 *
 * El enlace va a OpenStreetMap con el punto marcado: el panel no carga Leaflet
 * (evita 150 KB de librería en una pantalla que solo necesita un enlace).
 */
@Component({
  selector: 'app-direccion-entrega',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (direccion) {
      <p class="entrega-linea">
        <app-icono nombre="MapPin" [tamano]="14" />
        <span class="entrega-texto">
          <strong>Entrega:</strong> {{ direccion }}
          @if (enlace) {
            <a class="entrega-enlace" [href]="enlace" target="_blank" rel="noopener noreferrer">
              ver en el mapa
            </a>
          }
        </span>
      </p>
    } @else {
      <p class="entrega-linea entrega-sin-datos">
        <app-icono nombre="WarningCircle" [tamano]="14" />
        <span class="entrega-texto">Sin dirección de entrega registrada.</span>
      </p>
    }

    @if (telefono) {
      <p class="entrega-linea">
        <app-icono nombre="Phone" [tamano]="14" />
        <span class="entrega-texto"><strong>Teléfono:</strong> {{ telefono }}</span>
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: 0.35rem;
      }

      .entrega-linea {
        display: flex;
        align-items: flex-start;
        gap: 0.35rem;
        margin: 0 0 0.2rem;
        font-size: 0.85rem;
        color: #5a2d2d;
      }

      .entrega-linea app-icono {
        color: #c2416b;
        margin-top: 0.15rem;
      }

      .entrega-sin-datos app-icono {
        color: #a8323a;
      }

      .entrega-enlace {
        /* #A83259 sobre blanco = 6.5:1 (AA) */
        color: #a83259;
        font-weight: 600;
        text-decoration: underline;
        white-space: nowrap;
      }
    `
  ]
})
export class DireccionEntregaComponent {
  @Input() direccion: string | null | undefined = null;
  @Input() latitud: number | null | undefined = null;
  @Input() longitud: number | null | undefined = null;
  @Input() telefono: string | null | undefined = null;

  get enlace(): string | null {
    return enlaceMapa(this.latitud, this.longitud);
  }
}
