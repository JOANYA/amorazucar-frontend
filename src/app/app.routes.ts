import { Routes } from '@angular/router';
import { authGuard, soloInvitadoGuard } from './guards/auth.guard';

/**
 * RENDIMIENTO (Lighthouse): todas las rutas se cargan con loadComponent.
 *
 * Home y Entregas estaban importadas arriba (import estático), así que su
 * código viajaba SIEMPRE en el bundle inicial: quien entraba directo a
 * /login o /menu/ventas descargaba y ejecutaba dos páginas completas que
 * nunca iba a ver. Al pasarlas a carga diferida, el primer paquete solo
 * lleva el shell de la app y el resto se descarga al navegar.
 */
export const routes: Routes = [
  // Redirección inicial
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // HOME (sitio público)
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent)
  },

  // ENTREGAS / EVIDENCIAS — vitrina pública (el home enlaza aquí sin login)
  {
    path: 'entregas',
    loadComponent: () => import('./pages/entregas/entregas.component').then((m) => m.EntregasComponent)
  },

  // LOGIN (Solo invitados)
  {
    path: 'login',
    canActivate: [soloInvitadoGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },

  // REGISTRO (Solo invitados)
  {
    path: 'registro',
    canActivate: [soloInvitadoGuard],
    loadComponent: () => import('./pages/registro/registro.component').then((m) => m.RegistroComponent)
  },

  // RESULTADO DEL PAGO: a esta página devuelve Mercado Pago al cliente después de
  // pagar. Requiere sesión (la verificación del pedido usa el token del cliente).
  {
    path: 'pago/resultado',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/pago-resultado/pago-resultado.component').then((m) => m.PagoResultadoComponent)
  },

  // MENU: layout con sidebar. Requiere sesión (authGuard). Dentro de cada
  // módulo la interfaz se adapta al rol (cliente / pastelero / admin); el
  // backend vuelve a validar los permisos en cada petición.
  {
    path: 'menu',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/menu/menu.component').then((m) => m.MenuComponent),
    children: [
      { path: '', redirectTo: 'ventas', pathMatch: 'full' },
      {
        path: 'ventas',
        loadComponent: () => import('./pages/tienda/tienda.component').then((m) => m.TiendaComponent)
      },
      {
        path: 'entregas',
        loadComponent: () => import('./pages/entregas/entregas.component').then((m) => m.EntregasComponent)
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./pages/pedidos/pedidos.component').then((m) => m.PedidosComponent)
      },
      // Mi perfil: datos de contacto, ubicación de entrega y contraseña.
      // Sirve para cualquier rol con sesión (el backend valida por su cuenta
      // que solo se pueda editar el propio perfil).
      {
        path: 'perfil',
        loadComponent: () => import('./pages/perfil/perfil.component').then((m) => m.PerfilComponent)
      }
    ]
  },

  // 404 explícito. Antes el comodín redirigía a /home en silencio, así que
  // una URL mal escrita parecía funcionar. OJO: `dashboard` se eliminó porque
  // DashboardComponent no estaba enlazado desde ninguna ruta ni menú
  // (código muerto, según la auditoría).
  {
    path: '**',
    loadComponent: () => import('./pages/no-encontrado/no-encontrado.component').then((m) => m.NoEncontradoComponent)
  }
];
