import { Routes } from '@angular/router';
import { authGuard, soloInvitadoGuard } from './guards/auth.guard';
import { HomeComponent } from './pages/home/home.component';
import { EntregasComponent } from './pages/entregas/entregas.component';

export const routes: Routes = [
  // Redirección inicial
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // HOME (sitio público)
  { path: 'home', component: HomeComponent },

  // ENTREGAS / EVIDENCIAS — vitrina pública (el home enlaza aquí sin login)
  { path: 'entregas', component: EntregasComponent },

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

  // MENU: layout con sidebar (Protegido con AuthGuard). Antes /tienda y
  // /entregas eran páginas sueltas sin navegación entre ellas; ahora viven
  // como hijas de /menu, que trae el sidebar para moverse de una a otra.
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
      }
    ]
  },

  // Comodín SIEMPRE AL FINAL
  { path: '**', redirectTo: 'home' }
];