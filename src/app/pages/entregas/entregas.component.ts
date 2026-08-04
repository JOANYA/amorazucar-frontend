import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EntregasService, Entrega } from '../../services/entregas.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-entregas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './entregas.component.html',
  styleUrls: ['./entregas.component.css']
})
export class EntregasComponent implements OnInit {
  entregas: Entrega[] = [];
  esAdmin: boolean = false;

  // Campos del formulario Admin
  nuevoCliente: string = '';
  nuevoDistrito: string = '';
  imagenPreview: string = '';

  constructor(
    private entregasService: EntregasService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarEntregas();
    // Aquí validas si el usuario es administrador
    // Si aún no tienes roles configurados, puedes cambiarlo temporalmente a true para probar:
    this.esAdmin = this.authService.esAdmin(); 
  }

  cargarEntregas(): void {
    this.entregas = this.entregasService.obtenerEntregas();
  }

  // Permite procesar la imagen seleccionada localmente en la PC del Admin
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagenPreview = e.target.result; // Convierte la foto a Base64 para guardarla
      };
      reader.readAsDataURL(file);
    }
  }

  guardarEntrega(): void {
    if (!this.imagenPreview || !this.nuevoCliente) {
      alert('Por favor selecciona una foto e ingresa el nombre del cliente.');
      return;
    }

    this.entregasService.agregarEntrega({
      cliente: this.nuevoCliente,
      distrito: this.nuevoDistrito || 'Lima',
      imagenUrl: this.imagenPreview
    });

    // Limpiar formulario
    this.nuevoCliente = '';
    this.nuevoDistrito = '';
    this.imagenPreview = '';
    this.cargarEntregas();
  }

  eliminar(id: number): void {
    if (confirm('¿Deseas borrar esta entrega de la galería?')) {
      this.entregasService.eliminarEntrega(id);
      this.cargarEntregas();
    }
  }
}