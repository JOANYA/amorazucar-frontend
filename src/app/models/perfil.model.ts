/**
 * Modelos de "Mi perfil".
 *
 * Coinciden con lo que devuelve GET /api/usuarios/:id/perfil, que a su vez
 * sale de las columnas de la tabla `usuario`. El DNI, el rol y el estado NO
 * se editan desde el perfil: el primero identifica la cuenta y los otros dos
 * son administrativos.
 */
export interface Perfil {
  id_usuario: number;
  dni: string;
  nombre: string;
  apellido: string;
  rol: string;
  estado: string;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
}

/** Body de PUT /api/usuarios/:id/perfil */
export interface PerfilPayload {
  nombre: string;
  apellido: string;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
}

/** Body de PUT /api/usuarios/:id/password */
export interface CambioPasswordPayload {
  password_actual: string;
  password_nueva: string;
}

/** Un candidato que devuelve GET /api/geocodificacion/buscar */
export interface DireccionCandidata {
  etiqueta: string;
  latitud: number;
  longitud: number;
}

/** Respuesta de GET /api/geocodificacion/reversa */
export interface DireccionDelPunto {
  etiqueta: string;
  direccion: string | null;
}
