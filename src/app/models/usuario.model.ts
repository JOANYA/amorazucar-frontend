/**
 * Interfaces alineadas EXACTAMENTE con el modelo `Usuario` del backend
 * (backend/src/models/Usuario.js) y con lo que devuelven sus endpoints.
 * NO se agregan ni quitan atributos: dni, nombre, apellido, password_hash,
 * rol, telefono, correo, estado.
 */

export type RolUsuario = 'admin' | 'pastelero' | 'cliente';

/** Datos que el backend acepta en el body de POST /api/usuarios/registro */
export interface UsuarioRegistro {
  dni: string;
  nombre: string;
  apellido: string;
  password_hash: string;
  rol: RolUsuario;
  telefono?: string | null;
  correo?: string | null;
  estado?: string;
}

/** Datos que el backend acepta en el body de POST /api/usuarios/login */
export interface UsuarioLogin {
  dni: string;
  password_hash: string;
}

/**
 * Forma del objeto `usuario` que devuelve el login
 * (ver UsuarioRepository.login -> SELECT id_usuario, dni, nombre, apellido, rol, estado)
 */
export interface Usuario {
  id_usuario: number;
  dni: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  estado: string;
  telefono?: string | null;
  correo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LoginResponse {
  mensaje: string;
  usuario: Usuario;
  token: string;
}

export interface RegistroResponse {
  mensaje: string;
  resultado: {
    id_usuario: number;
    [key: string]: unknown;
  };
}

/** true si el rol tiene permiso de "soloVentas" en el backend (admin o cliente) */
export function puedeComprar(rol: RolUsuario): boolean {
  return rol === 'admin' || rol === 'cliente';
}

/** true si el rol tiene permiso de "soloPastelero" en el backend (admin o pastelero) */
export function puedeGestionarPostres(rol: RolUsuario): boolean {
  return rol === 'admin' || rol === 'pastelero';
}
