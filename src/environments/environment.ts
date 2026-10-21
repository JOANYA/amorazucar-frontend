export const environment = {
  production: false,
  // LOCALHOST: backend Express en tu máquina (npm run dev -> puerto 3000).
  // No cambiar mientras corras en local. Solo para nube usar la URL de Render.
  apiUrl: 'http://127.0.0.1:3000/api',
  // Pago con tarjeta DESHABILITADO en localhost hasta configurar Culqi.
  // Pasos en docs/notas-desarrollo/CULQI_LOCALHOST.md. Mientras tenga este valor, la tienda
  // muestra aviso y no revienta (ver tarjetaDisponible en tienda.component).
  culqiPublicKey: 'pk_test_TU_LLAVE_PUBLICA_AQUI'
};