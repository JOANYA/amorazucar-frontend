import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CatalogoService, Postre } from '../../services/catalogo.service';
import { Usuario } from '../../models/usuario.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  usuario: Usuario | null = null;
  postres: Postre[] = [];
  cargandoMenu = false;
  errorMenu = '';

  constructor(
    private authService: AuthService,
    private catalogoService: CatalogoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.usuario = this.authService.getUsuarioActual();
    this.cargarMenu();
  }

  cargarMenu(): void {
    this.cargandoMenu = true;
    this.errorMenu = '';
    this.catalogoService.listarPostres().subscribe({
      next: (postres) => {
        this.postres = postres;
        this.cargandoMenu = false;
      },
      error: () => {
        this.errorMenu = 'No se pudo cargar el catálogo de postres.';
        this.cargandoMenu = false;
      }
    });
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
