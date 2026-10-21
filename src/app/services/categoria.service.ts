import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Categoria {
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
  estado?: string;
}

/**
 * GET /api/categorias no requiere token. Se necesita para poder elegir
 * id_categoria al crear/editar un postre (campo obligatorio en el backend
 * que el formulario de postres no estaba enviando).
 */
@Injectable({
  providedIn: 'root'
})
export class CategoriaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.apiUrl}/categorias`);
  }
}
