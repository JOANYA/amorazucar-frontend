/** Refleja la fila que devuelve GET /api/notificaciones/usuario/:id_usuario */
export interface Notificacion {
  id_notificacion: number;
  id_usuario: number;
  id_venta: number | null;
  mensaje: string;
  fecha_envio?: string;
  fecha_creacion?: string;
  leido: boolean | number;
}
