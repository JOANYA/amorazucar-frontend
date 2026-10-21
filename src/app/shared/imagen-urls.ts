/**
 * Utilidades para pedir imágenes optimizadas.
 *
 * Vive en `shared/` porque la usan dos servicios: el catálogo (fotos de postres)
 * y las ventas (comprobantes de pago). Antes cada uno armaba sus URLs a mano y
 * los comprobantes se bajaban a tamaño original: una captura de celular de
 * ~1 MB para mostrarla a 160 px de ancho.
 *
 * Recordatorio de por qué importa (auditoría de Lighthouse "Improve image
 * delivery"): el navegador descarga la imagen completa aunque se pinte en una
 * tarjeta pequeña, y el peso extra retrasa el LCP.
 */

/** Anchos de las variantes WebP que se ofrecen en el `srcset`. */
export const ANCHOS_WEBP = [400, 800];

const MARCA_UPLOAD = '/image/upload/';

/** ¿Es una URL de Cloudinary (fotos subidas desde la app)? */
export function esUrlCloudinary(url: string): boolean {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(url);
}

/** ¿Es una URL absoluta de cualquier origen? */
export function esUrlAbsoluta(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Devuelve la URL de Cloudinary con la transformación pedida insertada después
 * de `/image/upload/`.
 *
 * `formato`: 'f_auto' deja que Cloudinary elija WebP/AVIF/JPEG según el
 * navegador; 'f_webp' fuerza WebP (se usa dentro de un <picture> con type).
 *
 * Si la URL no es de Cloudinary o YA trae una transformación escrita a mano, se
 * devuelve tal cual: no se pisan parámetros ajenos.
 */
export function urlCloudinaryOptimizada(url: string, ancho: number, formato = 'f_auto'): string {
  if (!esUrlCloudinary(url)) return url;

  const posicion = url.indexOf(MARCA_UPLOAD);
  if (posicion === -1) return url;

  const resto = url.slice(posicion + MARCA_UPLOAD.length);
  const primerSegmento = resto.split('/')[0];
  // Una URL sin transformar empieza por el número de versión (v1786...) o por
  // el nombre del archivo. Cualquier otra cosa ya viene transformada.
  const sinTransformar = /^v\d+$/.test(primerSegmento)
    || /\.(jpe?g|png|webp|avif|gif|bmp|tiff)$/i.test(primerSegmento);
  if (!sinTransformar) return url;

  const transformacion = `${formato},q_auto,w_${Math.round(ancho)},c_limit`;
  return `${url.slice(0, posicion + MARCA_UPLOAD.length)}${transformacion}/${resto}`;
}

/**
 * `srcset` en WebP de una foto de Cloudinary, para usar dentro de un <picture>
 * junto con un <img> de respaldo que apunte a la versión `f_auto`.
 * Devuelve null si no es una URL de Cloudinary.
 */
export function cloudinaryWebpSrcset(url: string): string | null {
  if (!esUrlCloudinary(url)) return null;
  return ANCHOS_WEBP
    .map((ancho) => `${urlCloudinaryOptimizada(url, ancho, 'f_webp')} ${ancho}w`)
    .join(', ');
}
