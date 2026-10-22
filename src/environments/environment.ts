/**
 * Entorno de DESARROLLO.
 *
 * Apunta al backend local (npm run dev en amorazucar-backend). El build de
 * producción NO usa este archivo: angular.json lo reemplaza por
 * environment.prod.ts, que sí apunta a Render.
 *
 * Este archivo estaba apuntando a la URL de Render, así que ng serve y las
 * pruebas de Karma hablaban con producción: los specs esperan
 * http://127.0.0.1:3000/api y fallaban 6 de 71.
 */
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:3000/api',
  culqiPublicKey: 'pk_test_TU_LLAVE_PUBLICA_AQUI'
};
