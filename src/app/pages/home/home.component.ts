import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { Postre } from '../../models/catalogo.model';
import { IconoComponent } from '../../shared/icono/icono.component';

const ESTADOS_OCULTOS = ['inactivo', 'agotado', 'eliminado', 'no disponible'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, IconoComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  // Postres destacados que se muestran en el Home, cargados desde el
  // catálogo real (GET /api/postres). Antes esta lista era fija y no
  // reflejaba los postres que el admin agregaba desde la Tienda.
  destacados: Postre[] = [];
  cargandoDestacados = false;

  /**
   * Postres del collage del hero: se eligen AL AZAR entre los que tienen foto,
   * para que cada visita muestre una combinación distinta y la página no se
   * vea congelada. Se prefiere lo que sí representa a la pastelería: si hay
   * variedad, se evita que toda la vitrina sean panes.
   */
  collage: Postre[] = [];

  /**
   * Señales de confianza del hero.
   * Responden a las dudas que frenan una compra por internet a un negocio
   * pequeño: ¿es fresco?, ¿me lo llevan?, ¿cómo pago?, ¿es real?
   */
  readonly puntosDeConfianza: { icono: string; titulo: string; texto: string }[] = [
    { icono: 'Cookie',     titulo: 'Horneado hoy',        texto: 'nada de stock viejo' },
    { icono: 'Motorcycle', titulo: 'Entrega a domicilio', texto: 'en Lima, el mismo día' },
    { icono: 'SealCheck',  titulo: 'Paga como prefieras', texto: 'Yape, Plin, tarjeta o efectivo' },
    { icono: 'Image',      titulo: 'Entregas reales',     texto: 'fotos de cada pedido' }
  ];

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
        const disponibles = data.filter(
          (p) => !ESTADOS_OCULTOS.includes(p.estado?.toLowerCase() ?? '') && p.stock_total > 0
        );

        this.destacados = [...disponibles]
          // Los más recientes primero (mayor id = agregado más reciente),
          // así un postre nuevo aparece de inmediato en el Home.
          .sort((a, b) => b.id_postre - a.id_postre)
          .slice(0, 6);

        this.collage = this.elegirCollage(disponibles);
        this.cargandoDestacados = false;
      },
      error: () => {
        this.destacados = [];
        this.collage = [];
        this.cargandoDestacados = false;
      }
    });
  }

  /**
   * Elige 3 postres CON FOTO para el collage del hero, al azar.
   * Se barajan y se ordenan de forma que el que ocupa la pieza grande sea un
   * postre dulce (tortas, postres o bocaditos) y no un pan, porque es la
   * primera imagen que ve quien entra a una pastelería.
   */
  private elegirCollage(todos: Postre[]): Postre[] {
    const conFoto = todos.filter((p) => !!p.imagen);
    if (conFoto.length === 0) return [];

    // Barajado simple (Fisher-Yates) para variar en cada visita
    const barajados = [...conFoto];
    for (let i = barajados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
    }

    const tres = barajados.slice(0, 3);

    // La categoría 4 es "Panaderia": si la pieza grande es un pan y hay
    // alternativa, se intercambia con otra pieza.
    if (tres.length > 1 && Number(tres[0].id_categoria) === 4) {
      const alternativa = tres.findIndex((p, i) => i > 0 && Number(p.id_categoria) !== 4);
      if (alternativa > 0) {
        [tres[0], tres[alternativa]] = [tres[alternativa], tres[0]];
      }
    }

    return tres;
  }

  /**
   * URL completa de la foto del postre (o cadena vacía si no tiene, para usar
   * el emoji de respaldo).
   *
   * `ancho` es el ancho real al que se muestra la imagen: el collage del hero
   * es grande (800 px) y las tarjetas del catálogo son chicas (600 px, más que
   * suficiente para pantallas de alta densidad). Así el navegador no descarga
   * una foto de 2000 px para pintarla a 400.
   */
  urlImagenPostre(postre: Postre, ancho = 600): string {
    return postre.imagen ? this.catalogoService.urlImagen(postre.imagen, ancho) : '';
  }

  /**
   * Variantes WebP de la foto para el <picture>. Con esto el navegador baja la
   * versión de 400 px en pantallas normales y la de 800 px solo en retina;
   * antes se bajaba siempre la foto original completa.
   */
  webpSrcset(postre: Postre): string | null {
    return postre.imagen ? this.catalogoService.webpSrcset(postre.imagen) : null;
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