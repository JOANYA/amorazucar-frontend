import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EntregasService, Entrega } from '../../services/entregas.service';
import { AuthService } from '../../services/auth.service';

/** Lado máximo (px) al que se reduce una foto antes de guardarla. */
const MAX_LADO_IMAGEN = 1000;
/** Calidad JPEG de la reducción (0-1). */
const CALIDAD_JPEG = 0.7;

@Component({
  selector: 'app-entregas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './entregas.component.html',
  styleUrls: ['./entregas.component.css']
})
export class EntregasComponent implements OnInit {
  entregas: Entrega[] = [];
  esAdmin = false;

  // Campos del formulario Admin
  nuevoCliente = '';
  nuevoDistrito = '';
  imagenPreview = '';

  // Avisos en pantalla (antes se usaban alert()/confirm() del navegador)
  mensajeExito = '';
  mensajeError = '';
  procesandoImagen = false;
  /** Entrega pendiente de confirmar para borrar. */
  idPendienteBorrar: number | null = null;

  constructor(
    private entregasService: EntregasService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarEntregas();
    this.esAdmin = this.authService.esAdmin();
  }

  cargarEntregas(): void {
    this.entregas = this.entregasService.obtenerEntregas();
  }

  /**
   * Procesa la imagen elegida por el admin.
   *
   * Antes se guardaba la foto ORIGINAL en base64 dentro de localStorage, sin
   * límite de tamaño ni control de errores: una foto de cámara de varios MB
   * llenaba la cuota del navegador y lanzaba QuotaExceededError. Ahora la
   * imagen se reduce (máximo 1000 px de lado, JPEG 70%) antes de guardarla.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.mensajeError = '';
    this.mensajeExito = '';

    if (!file.type.startsWith('image/')) {
      this.mensajeError = 'El archivo debe ser una imagen.';
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.mensajeError = 'La imagen no puede pesar más de 10 MB.';
      input.value = '';
      return;
    }

    this.procesandoImagen = true;
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const imagen = new Image();
      imagen.onload = () => {
        this.imagenPreview = this.reducirImagen(imagen);
        this.procesandoImagen = false;
      };
      imagen.onerror = () => {
        this.imagenPreview = dataUrl;
        this.procesandoImagen = false;
      };
      imagen.src = dataUrl;
    };

    reader.onerror = () => {
      this.procesandoImagen = false;
      this.mensajeError = 'No se pudo leer la imagen seleccionada.';
    };

    reader.readAsDataURL(file);
  }

  /** Reduce la imagen manteniendo la proporción y devuelve un dataURL JPEG. */
  private reducirImagen(imagen: HTMLImageElement): string {
    const { width, height } = imagen;
    const escala = Math.min(1, MAX_LADO_IMAGEN / Math.max(width, height));
    const destino = document.createElement('canvas');
    destino.width = Math.max(1, Math.round(width * escala));
    destino.height = Math.max(1, Math.round(height * escala));

    const ctx = destino.getContext('2d');
    if (!ctx) return imagen.src;
    ctx.drawImage(imagen, 0, 0, destino.width, destino.height);

    try {
      return destino.toDataURL('image/jpeg', CALIDAD_JPEG);
    } catch {
      return imagen.src;
    }
  }

  guardarEntrega(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    // El panel no es un <form>, así que el `required` del HTML no bloquea nada:
    // la validación tiene que estar aquí.
    const cliente = this.nuevoCliente?.trim() ?? '';
    const distrito = this.nuevoDistrito?.trim() ?? '';

    if (cliente.length < 2) {
      this.mensajeError = 'Ingresa el nombre o las iniciales del cliente (mínimo 2 caracteres).';
      return;
    }
    if (distrito.length < 2) {
      this.mensajeError = 'Indica el distrito o zona de entrega.';
      return;
    }
    if (!this.imagenPreview) {
      this.mensajeError = 'Selecciona la foto de la entrega.';
      return;
    }

    try {
      this.entregasService.agregarEntrega({
        cliente,
        distrito,
        imagenUrl: this.imagenPreview
      });
    } catch (e) {
      // Antes esto reventaba sin aviso cuando se llenaba la cuota del navegador.
      this.mensajeError =
        'No se pudo guardar la entrega: el almacenamiento del navegador está lleno. ' +
        'Elimina alguna entrega antigua e inténtalo de nuevo.';
      return;
    }

    this.nuevoCliente = '';
    this.nuevoDistrito = '';
    this.imagenPreview = '';
    this.cargarEntregas();
    this.mensajeExito = 'Entrega publicada en la galería.';
  }

  pedirBorrado(id: number): void {
    this.mensajeError = '';
    this.mensajeExito = '';
    this.idPendienteBorrar = id;
  }

  cancelarBorrado(): void {
    this.idPendienteBorrar = null;
  }

  confirmarBorrado(): void {
    if (this.idPendienteBorrar === null) return;
    this.entregasService.eliminarEntrega(this.idPendienteBorrar);
    this.idPendienteBorrar = null;
    this.cargarEntregas();
    this.mensajeExito = 'Entrega eliminada de la galería.';
  }
}
