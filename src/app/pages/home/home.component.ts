import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { Postre } from '../../models/catalogo.model';

// Emojis "de respaldo" solo para darle un ícono a cada tarjeta cuando el
// postre no trae imagen propia. Se eligen rotando esta lista, no dependen
// del nombre del postre.
const EMOJIS_POSTRES = ['🧁', '🍰', '🍮', '🍫', '🍓', '🥐', '🍪', '🎂'];

const ESTADOS_OCULTOS = ['inactivo', 'agotado', 'eliminado', 'no disponible'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  // Postres destacados que se muestran en el Home, cargados desde el
  // catálogo real (GET /api/postres). Antes esta lista era fija y no
  // reflejaba los postres que el admin agregaba desde la Tienda.
  destacados: (Postre & { emoji: string })[] = [];
  cargandoDestacados = false;

  constructor(
    private authService: AuthService,
    private catalogoService: CatalogoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarDestacados();
  }

  cargarDestacados(): void {
    this.cargandoDestacados = true;
    this.catalogoService.listarPostres().subscribe({
      next: (data) => {
        this.destacados = data
          .filter((p) => !ESTADOS_OCULTOS.includes(p.estado?.toLowerCase() ?? '') && p.stock_total > 0)
          // Los más recientes primero (mayor id = agregado más reciente),
          // así un postre nuevo aparece de inmediato en el Home.
          .sort((a, b) => b.id_postre - a.id_postre)
          .slice(0, 6)
          .map((p, i) => ({ ...p, emoji: EMOJIS_POSTRES[i % EMOJIS_POSTRES.length] }));
        this.cargandoDestacados = false;
      },
      error: () => {
        this.destacados = [];
        this.cargandoDestacados = false;
      }
    });
  }

  /** URL completa de la foto del postre (o cadena vacía si no tiene, para usar el emoji de respaldo) */
  urlImagenPostre(postre: Postre): string {
    return postre.imagen ? this.catalogoService.urlImagen(postre.imagen) : '';
  }

  // Getters para evaluar el estado del usuario en la plantilla
  get estaAutenticado(): boolean {
    return this.authService.estaAutenticado();
  }

  get nombreUsuario(): string {
    const usuario = this.authService.getUsuarioActual();
    if (!usuario) return '';
    return usuario.nombre || usuario.dni || 'Usuario';
  }

  get esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  // Método para cerrar sesión
  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Botón "Quiero comprar": si tiene sesión va a la tienda, si no, lo manda a Login
  irAComprar(): void {
    if (this.estaAutenticado) {
      this.router.navigate(['/menu/ventas']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  // Redirección directa e incondicional a Login
  irALogin(): void {
    this.router.navigate(['/login']);
  }

  // Redirección directa e incondicional a Registro
  irARegistro(): void {
    this.router.navigate(['/registro']);
  }

  // Navegación hacia la página de entregas
  irAEntregas(): void {
    this.router.navigate(['/entregas']);
  }
}