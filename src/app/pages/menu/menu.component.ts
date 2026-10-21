import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificacionService } from '../../services/notificacion.service';
import { Notificacion } from '../../models/notificacion.model';
import { puedeGestionarPostres } from '../../models/usuario.model';
import { IconoComponent } from '../../shared/icono/icono.component';

/**
 * Layout tipo CRM: sidebar izquierdo fijo + contenido de la ruta hija a la
 * derecha (router-outlet). Es el shell que envuelve /menu/ventas,
 * /menu/entregas, etc. una vez que el usuario inició sesión.
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, IconoComponent],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  sidebarAbierto = true;

  // --- Notificaciones (pago confirmado, pedido cancelado, comprobante nuevo) ---
  notificaciones: Notificacion[] = [];
  mostrarNotificaciones = false;

  /**
   * Temporizador del refresco de notificaciones.
   * Antes se hacía setInterval() sin guardar la referencia ni limpiarla, así
   * que cada vez que se entraba a /menu quedaba un temporizador vivo en
   * segundo plano consultando la API (fuga de memoria y de peticiones).
   */
  private intervalNotificaciones?: ReturnType<typeof setInterval>;

  constructor(
    private authService: AuthService,
    private notificacionService: NotificacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarNotificaciones();
    // Refresca cada 60s para que la campanita se actualice sin recargar la página.
    this.intervalNotificaciones = setInterval(() => this.cargarNotificaciones(), 60000);
  }

  ngOnDestroy(): void {
    if (this.intervalNotificaciones) {
      clearInterval(this.intervalNotificaciones);
      this.intervalNotificaciones = undefined;
    }
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

  /**
   * Puede administrar el catálogo de postres: admin o pastelero.
   * (Antes existía además `puedeVender`, que no se usaba en ninguna plantilla
   * y decía lo mismo que "estar autenticado"; se eliminó como código muerto.)
   */
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
