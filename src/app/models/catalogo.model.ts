/** Refleja exactamente la fila que devuelve GET /api/postres */
export interface Postre {
  id_postre: number;
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
  precio_actual: number;
  stock_total: number;
  estado: string;
  /** Ruta relativa (ej. /images/postres/postre-3-...jpg) o null si no tiene foto propia */
  imagen?: string | null;
}
