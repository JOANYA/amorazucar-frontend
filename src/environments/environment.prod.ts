/**
 * Entorno de producción (`ng build` usa este archivo en lugar de
 * `environment.ts`, ver `angular.json` -> fileReplacements).
 *
 * `apiUrl` DEBE apuntar al backend realmente publicado. El valor anterior era
 * `https://amorazucar-backend.onrender.com/api`, un despliegue de Render que ya
 * no está en uso: quien corriera `npm run preview:prod` creería que hay una API
 * en la nube respondiendo y en realidad todas las peticiones fallarían.
 *
 * Antes de publicar:
 *   1) Sustituye `apiUrl` por la URL real del backend desplegado.
 *   2) Sustituye `culqiPublicKey` por tu llave pública de Culqi y descomenta el
 *      <script> del widget en `src/index.html` (ver docs/notas-desarrollo/CULQI_LOCALHOST.md).
 *   3) Cambia también el `preconnect` de `src/index.html`, que hoy apunta a
 *      127.0.0.1:3000.
 *
 * Mientras los valores sigan siendo marcadores, la app avisa y no revienta: la
 * tienda deshabilita el pago con tarjeta (ver `tarjetaDisponible` en
 * tienda.component.ts).
 */
export const environment = {
  production: true,
  apiUrl: 'https://TU-BACKEND-PUBLICADO/api',
  culqiPublicKey: 'pk_test_TU_LLAVE_PUBLICA_AQUI'
};
