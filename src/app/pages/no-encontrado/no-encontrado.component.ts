import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Página 404.
 * Antes no existía: el comodín `**` redirigía a /home en silencio, así que
 * cualquier URL mal escrita parecía correcta y el usuario no entendía por qué
 * terminaba en el inicio.
 */
@Component({
  selector: 'app-no-encontrado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- ACCESIBILIDAD: <main> = landmark principal de la página -->
    <main class="no-encontrado">
      <div class="contenido">
        <p class="codigo">404</p>
        <h1>No encontramos esta página</h1>
        <p class="mensaje">
          Puede que el enlace esté mal escrito o que la página ya no exista.
        </p>
        <div class="acciones">
          <a routerLink="/home" class="btn-principal">Volver al inicio</a>
          <a routerLink="/menu/ventas" class="btn-secundario">Ir a la tienda</a>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .no-encontrado {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FFF8F2;
      padding: 24px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      text-align: center;
    }
    .contenido { max-width: 480px; }
    .codigo {
      font-size: 72px;
      font-weight: 700;
      margin: 0;
      color: #5A2D2D;
      line-height: 1;
    }
    h1 {
      font-size: 22px;
      color: #5A2D2D;
      margin: 12px 0 8px;
    }
    .mensaje {
      color: #6b4a4a;
      margin-bottom: 24px;
    }
    .acciones {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn-principal,
    .btn-secundario {
      padding: 12px 22px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
    }
    /* Blanco sobre #C2416B = 5.4:1 (AA) */
    .btn-principal { background: #C2416B; color: #ffffff; }
    .btn-secundario {
      background: transparent;
      color: #5A2D2D;
      border: 2px solid #5A2D2D;
    }
    @media (max-width: 480px) {
      .codigo { font-size: 56px; }
      .acciones { flex-direction: column; }
    }
  `]
})
export class NoEncontradoComponent {}
