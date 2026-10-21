/**
 * Utilidades de ubicación.
 *
 * Se separan del componente para poder probarlas sin navegador (igual que
 * `imagen-urls.ts` con las URLs de Cloudinary).
 */

/**
 * Enlace al mapa público de OpenStreetMap con el punto marcado.
 *
 * El panel del admin muestra la ubicación del cliente sin cargar Leaflet:
 * OpenStreetMap acepta el marcador por parámetros en la URL, así que basta un
 * enlace. Devuelve null cuando el pedido no trae coordenadas, para que la
 * plantilla pueda decidir si muestra el enlace o un texto de "sin ubicación".
 */
export function enlaceMapa(latitud: number | null | undefined, longitud: number | null | undefined): string | null {
  const vacio = (valor: number | null | undefined) => valor === null || valor === undefined;
  if (vacio(latitud) || vacio(longitud)) return null;

  const lat = Number(latitud);
  const lon = Number(longitud);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

/**
 * Coordenadas legibles para mostrar junto a la dirección: "-12.046400, -77.042800".
 *
 * OJO: hay que descartar null/undefined ANTES de convertir, porque
 * `Number(null)` es 0 y no NaN, así que "sin ubicación" se mostraba como
 * "0.000000, 0.000000" (un punto en el golfo de Guinea que nadie eligió).
 * Esa comprobación la cubre la prueba de `coordenadasLegibles`.
 */
export function coordenadasLegibles(latitud: number | null | undefined, longitud: number | null | undefined): string | null {
  const vacio = (valor: number | null | undefined) => valor === null || valor === undefined;
  if (vacio(latitud) || vacio(longitud)) return null;

  const lat = Number(latitud);
  const lon = Number(longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}
