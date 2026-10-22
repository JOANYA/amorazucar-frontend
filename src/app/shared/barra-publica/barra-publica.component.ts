import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconoComponent } from '../icono/icono.component';

/**
 * Barra de navegación de las páginas públicas (inicio, tienda, entregas, login).
 *
 * Antes cada pantalla pública traía su propio encabezado: la home tenía marca y
 * botones, entregas solo un «Volver al inicio», y el login no tenía nada (quien
 * llegaba ahí no podía volver a la tienda sin escribir la URL). Con una sola
 * barra, la marca siempre es un enlace al inicio y los tres enlaces del sitio
 * están a la vista.
 */
@Component({
  selector: 'app-barra-publica',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconoComponent],
  template: `
    <header class="barra-publica">
      <div class="barra-fila">
        <a routerLink="/home" class="marca" aria-label="Azúcar & Amor, ir al inicio">
          <span class="marca-icono"><app-icono nombre="Storefront" [tamano]="22" /></span>
          Azúcar &amp; Amor
        </a>

        <div class="acciones">
          @if (estaAutenticado) {
            <a routerLink="/menu/ventas" class="btn-solido">
              <app-icono nombre="ShoppingCart" [tamano]="16" />
              <span>Mi tienda</span>
            </a>
            <button type="button" class="btn-linea" (click)="cerrarSesion()">
              <app-icono nombre="SignOut" [tamano]="16" />
              <span>Salir</span>
            </button>
          } @else {
            <a routerLink="/login" class="btn-linea">
              <app-icono nombre="SignIn" [tamano]="16" />
              <span>Ingresar</span>
            </a>
            <a routerLink="/registro" class="btn-solido btn-registro">
              <app-icono nombre="UserPlus" [tamano]="16" />
              <span>Crear cuenta</span>
            </a>
          }
        </div>
      </div>

      <nav class="barra-nav" aria-label="Navegación del sitio">
        <a routerLink="/home" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Inicio</a>
        <a routerLink="/tienda" routerLinkActive="activo">Tienda</a>
        <a routerLink="/entregas" routerLinkActive="activo">Entregas</a>
        <a
          class="nav-whatsapp"
          href="https://wa.me/51905502811?text=Hola,%20quisiera%20hacer%20un%20pedido%20en%20Az%C3%BAcar%20%26%20Amor"
          target="_blank"
          rel="noopener noreferrer"
        >
          <app-icono nombre="WhatsappLogo" [tamano]="16" /> Pedir por WhatsApp
        </a>
      </nav>
    </header>
  `,
  styles: [`
    .barra-publica {
      background: #5A2D2D;
      color: #fff;
    }

    .barra-fila {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .marca {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #fff;
      font-weight: 800;
      font-size: 1.15rem;
      text-decoration: none;
      letter-spacing: -0.01em;
    }

    .marca-icono {
      display: inline-flex;
      color: #F3C6D4;
    }

    .acciones {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-linea,
    .btn-solido {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      border-radius: 999px;
      padding: 0.45rem 0.95rem;
      font-weight: 600;
      font-size: 0.92rem;
      text-decoration: none;
      line-height: 1.2;
      white-space: nowrap;
    }

    .btn-linea {
      background: transparent;
      border: 1.5px solid rgba(255, 255, 255, 0.6);
      color: #fff;
      cursor: pointer;
    }

    .btn-linea:hover,
    .btn-linea:focus-visible {
      background: rgba(255, 255, 255, 0.12);
      border-color: #fff;
    }

    .btn-solido {
      background: #F3C6D4;
      border: 1.5px solid #F3C6D4;
      color: #5A2D2D;
      font-weight: 700;
    }

    .btn-solido:hover,
    .btn-solido:focus-visible {
      background: #fff;
      border-color: #fff;
    }

    .barra-nav {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.25rem;
      display: flex;
      align-items: center;
      gap: 1.35rem;
      border-top: 1px solid rgba(255, 255, 255, 0.16);
      overflow-x: auto;
    }

    .barra-nav a {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.6rem 0 0.55rem;
      color: rgba(255, 255, 255, 0.82);
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      border-bottom: 2px solid transparent;
    }

    .barra-nav a:hover,
    .barra-nav a:focus-visible {
      color: #fff;
    }

    .barra-nav a.activo {
      color: #fff;
      border-bottom-color: #F3C6D4;
    }

    .nav-whatsapp {
      margin-left: auto;
      color: #F3C6D4 !important;
    }

    /* En pantallas angostas la marca y un solo botón ya no caben en la misma
       fila, así que se oculta «Crear cuenta» (sigue disponible desde el login). */
    @media (max-width: 520px) {
      .barra-fila {
        padding: 0.7rem 1rem;
      }

      .marca {
        font-size: 1.05rem;
      }

      .btn-registro {
        display: none;
      }

      .barra-nav {
        padding: 0 1rem;
        gap: 1rem;
      }
    }
  `]
})
export class BarraPublicaComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  get estaAutenticado(): boolean {
    return this.authService.estaAutenticado();
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/home']);
  }
}
