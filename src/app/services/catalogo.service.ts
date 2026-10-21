import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Postre } from '../models/catalogo.model';
import {
  ANCHOS_WEBP,
  cloudinaryWebpSrcset,
  esUrlAbsoluta,
  urlCloudinaryOptimizada
} from '../shared/imagen-urls';

export type { Postre };

/**
 * Datos que acepta el backend al crear o editar un postre.
 * `id_categoria` y `precio_actual` son obligatorios al crear; al editar, el
 * backend completa lo que falte con los valores actuales del postre.
 */
export interface PostrePayload {
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
  precio_actual: number;
  stock_total?: number;
  estado?: string;
}

/**
 * Servicio para el catálogo público de la pastelería.
 * Consume rutas que en el backend NO requieren token:
 *   GET /api/postres
 *   GET /api/menu-dia/hoy
 *
 * NOTA: antes `listarPostres()` y `eliminarPostre()` armaban a mano una
 * cabecera `Authorization: Bearer null`, porque leían la clave `token` de
 * localStorage... que nunca se escribe (la real es `azucaryamor_token`).
 * El interceptor (auth.interceptor.ts) ya adjunta el token correcto, así que
 * esas cabeceras manuales solo podían estropear la petición.
 */
@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarPostres(): Observable<Postre[]> {
    return this.http.get<Postre[]>(`${this.apiUrl}/postres`);
  }

  /** GET /api/menu-dia/hoy */
  obtenerMenuHoy(): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.apiUrl}/menu-dia/hoy`);
  }

  crearPostre(postre: PostrePayload): Observable<Postre> {
    return this.http.post<Postre>(`${this.apiUrl}/postres`, postre);
  }

  actualizarPostre(id: number, postre: Partial<PostrePayload>): Observable<Postre> {
    return this.http.put<Postre>(`${this.apiUrl}/postres/${id}`, postre);
  }

  eliminarPostre(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/postres/${id}`);
  }

  /** POST /api/postres/:id/imagen — sube o reemplaza la foto del postre (multipart) */
  subirImagenPostre(id: number, archivo: File): Observable<{ mensaje: string; imagen: string }> {
    const formData = new FormData();
    formData.append('imagen', archivo);
    return this.http.post<{ mensaje: string; imagen: string }>(`${this.apiUrl}/postres/${id}/imagen`, formData);
  }

  /**
   * Arma la URL completa de una imagen guardada en el backend (foto de postre).
   *
   * Las fotos nuevas viven en Cloudinary (https://res.cloudinary.com/...).
   * Ahí SÍ conviene pedirlas transformadas: la foto original pesa ~200 KB y
   * en la tarjeta se ve a 400x160 px, así que el navegador descarga 5 veces
   * más bytes de los que muestra. Con `f_auto,q_auto,w_<ancho>,c_limit`
   * Cloudinary entrega WebP/AVIF (o JPEG si el navegador no los soporta) ya
   * redimensionado: la misma foto pasa de ~203 KB a ~51 KB.
   *
   * Las fotos antiguas siguen guardadas como ruta local (/images/postres/...) y
   * se sirven tal cual desde el backend.
   */
  urlImagen(ruta: string, ancho = 600): string {
    if (!ruta) return '';
    if (esUrlAbsoluta(ruta)) {
      return urlCloudinaryOptimizada(ruta, ancho);
    }
    return `${this.apiUrl.replace(/\/api\/?$/, '')}${ruta}`;
  }

  /**
   * `srcset` en WebP para usar dentro de un <picture>.
   *
   * - Fotos de Cloudinary: se piden dos transformaciones con `f_webp`.
   * - Fotos locales: apunta a los `.webp` hermanos que genera el script
   *   `npm run optimizar-imagenes` del backend (el JPEG original queda como
   *   respaldo en el <img>).
   * - Cualquier otra URL: `null`, y el navegador usa el <img> normal.
   *
   * Con `sizes` en el <img>, un escritorio normal descarga el archivo de
   * 400 px (una fracción del peso) en vez de la foto completa.
   */
  webpSrcset(ruta: string): string | null {
    if (!ruta) return null;

    if (esUrlAbsoluta(ruta)) {
      return cloudinaryWebpSrcset(ruta);
    }

    // Foto local: los .webp hermanos que genera el backend con
    // `npm run optimizar-imagenes`.
    const base = `${this.apiUrl.replace(/\/api\/?$/, '')}${ruta.replace(/\.(jpe?g|png)$/i, '')}`;
    return ANCHOS_WEBP.map((ancho) => `${base}-${ancho}.webp ${ancho}w`).join(', ');
  }
}
