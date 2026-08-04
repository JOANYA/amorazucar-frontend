import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificacionService } from '../../services/notificacion.service';
import { Notificacion } from '../../models/notificacion.model';
import { puedeComprar, puedeGestionarPostres } from '../../models/usuario.model';

/**
 * Layout tipo CRM: sidebar izquierdo fijo + contenido de la ruta hija a la
 * derecha (router-outlet). Es el shell que envuelve /menu/ventas,
 * /menu/entregas, etc. una vez que el usuario inició sesión.
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  sidebarAbierto = true;

  // --- Notificaciones (pago confirmado, pedido cancelado, comprobante nuevo) ---
  notificaciones: Notificacion[] = [];
  mostrarNotificaciones = false;

  constructor(
    private authService: AuthService,
    private notificacionService: NotificacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarNotificaciones();
    // Refresca cada 60s para que la campanita se actualice sin recargar la página.
    setInterval(() => this.cargarNotificaciones(), 60000);
  }

  cargarNotificaciones(): void {
    const idUsuario = this.usuario?.id_usuario;
    if (!idUsuario) return;
    this.notificacionService.listarPorUsuario(idUsuario).subscribe({
      next: (data) => (this.notificaciones = data),
      error: () => (this.notificaciones = [])
    });
  }

  get notificacionesNoLeidas(): number {
    return this.notificaciones.filter((n) => !n.leido).length;
  }

  toggleNotificaciones(): void {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
  }

  marcarLeida(notificacion: Notificacion): void {
    if (notificacion.leido) return;
    this.notificacionService.marcarComoLeida(notificacion.id_notificacion).subscribe({
      next: () => (notificacion.leido = true)
    });
  }

  get usuario() {
    return this.authService.getUsuarioActual();
  }

  get nombreUsuario(): string {
    const u = this.usuario;
    if (!u) return '';
    return `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || u.dni;
  }

  get rolUsuario(): string {
    return this.usuario?.rol ?? '';
  }

  /** Puede vender (registrar compras/ventas): admin o vendedor */
  get puedeVender(): boolean {
    const u = this.usuario;
    return !!u && puedeComprar(u.rol);
  }

  /** Puede administrar el catálogo de postres: admin o pastelero */
  get puedeAdministrarCatalogo(): boolean {
    const u = this.usuario;
    return !!u && puedeGestionarPostres(u.rol);
  }

  get esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  toggleSidebar(): void {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
