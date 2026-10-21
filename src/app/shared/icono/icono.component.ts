import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONOS_PHOSPHOR, IconoPhosphor } from '../iconos-phosphor';

/** Se usa si el nombre solicitado no existe, para no romper la pantalla. */
const ICONO_ALTERNATIVO: IconoPhosphor = {
  viewBox: '0 0 256 256',
  contenido: '<circle cx="128" cy="128" r="96"/>'
};

/**
 * Icono Phosphor (variante fill).
 *
 * IMPORTANTE — por qué se marca el HTML como confiable:
 * Angular sanea el contenido que se inyecta con [innerHTML], y su lista blanca
 * de saneado NO incluye elementos SVG como <path>, que es lo que dibuja
 * prácticamente todo icono Phosphor. Sin este paso el <svg> se renderiza pero
 * queda VACÍO: cajas de 20x20 invisibles (fallo real, comprobado en el navegador).
 *
 * Es seguro porque el contenido NO viene del usuario: son cadenas fijas del
 * catálogo `iconos-phosphor.ts`, generado a partir de los SVG oficiales de
 * @phosphor-icons/core. No se interpola ningún dato de entrada.
 *
 * Uso:
 *   <app-icono nombre="ShoppingCart" [tamano]="22" />
 *   <app-icono nombre="Bell" etiqueta="Notificaciones" />
 */
@Component({
  selector: 'app-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="icono.viewBox"
      [attr.width]="tamano"
      [attr.height]="tamano"
      fill="currentColor"
      [attr.role]="etiqueta ? 'img' : null"
      [attr.aria-label]="etiqueta || null"
      [attr.aria-hidden]="etiqueta ? null : 'true'"
      [attr.focusable]="false"
      [innerHTML]="contenidoSeguro"
    ></svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      flex-shrink: 0;
    }
    svg {
      display: block;
    }
  `]
})
export class IconoComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Catálogo ya saneado, uno por icono. Se construye una sola vez por
   * instancia para no repetir el saneado en cada ciclo de detección.
   */
  private readonly contenidos = new Map<string, SafeHtml>();

  constructor() {
    for (const [clave, icono] of Object.entries(ICONOS_PHOSPHOR)) {
      this.contenidos.set(clave, this.sanitizer.bypassSecurityTrustHtml(icono.contenido));
    }
    this.contenidos.set(
      'Circle',
      this.sanitizer.bypassSecurityTrustHtml(ICONO_ALTERNATIVO.contenido)
    );
  }

  /** Nombre del icono, por ejemplo 'Bell', 'ShoppingCart', 'Trash'. */
  @Input({ required: true }) nombre = 'Circle';

  /** Tamaño en píxeles (ancho y alto). */
  @Input() tamano: number | string = 20;

  /**
   * Texto alternativo. Si se indica, el icono se anuncia a los lectores de
   * pantalla; si se omite, se marca como decorativo (`aria-hidden`), que es lo
   * correcto cuando el icono acompaña a un texto visible.
   */
  @Input() etiqueta?: string;

  /** Contenido seguro del icono actual (se recalcula solo si cambia el nombre). */
  get contenidoSeguro(): SafeHtml {
    return this.contenidos.get(this.nombre) ?? this.contenidos.get('Circle')!;
  }

  get icono(): IconoPhosphor {
    return ICONOS_PHOSPHOR[this.nombre] ?? ICONO_ALTERNATIVO;
  }
}
