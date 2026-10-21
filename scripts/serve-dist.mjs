/**
 * Servidor de VISTA PREVIA DE PRODUCCIÓN para "Azúcar & Amor" (frontend).
 *
 * ¿Para qué sirve?
 *   `ng serve` es un servidor de DESARROLLO: entrega los paquetes sin minificar,
 *   sin tree-shaking, con mapas de código y sin compresión. Si auditas eso con
 *   Lighthouse, el resultado es un Performance muy bajo (~50) aunque tu código
 *   esté perfecto. Este script sirve el build REAL de producción (`ng build`)
 *   comprimido, que es lo que verá un usuario en internet.
 *
 * Uso:
 *   npm run preview        -> sirve dist/front/browser en http://127.0.0.1:4300
 *   npm run preview:prod    -> compila en producción y luego lo sirve
 *
 * No usa dependencias: solo módulos nativos de Node (http, fs, zlib, path).
 */

import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist', 'front', 'browser');

// El puerto NUNCA debe salir del entorno como 0 (listen(0) = puerto aleatorio).
const PUERTO = Number(process.env.PORT_DIST) || 4300;
const HOST = process.env.HOST || '127.0.0.1';

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error(`\n❌ No existe ${DIST}\\index.html`);
  console.error('   Compila primero:  npm run build\n');
  process.exit(1);
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

const COMPRIMIBLES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);

/** Cache de versiones comprimidas en memoria (el build no cambia mientras corre). */
const cacheComprimido = new Map();

function comprimir(archivo, buffer, mtimeMs = 0) {
  // La clave incluye la fecha del archivo: si recompilas y el servidor sigue
  // encendido, no se sirve una versión comprimida vieja.
  const clave = `${archivo}:${mtimeMs}`;
  if (cacheComprimido.has(clave)) return cacheComprimido.get(clave);
  const ext = path.extname(archivo).toLowerCase();
  const resultado = { br: null, gzip: null };
  if (COMPRIMIBLES.has(ext) && buffer.length > 1024) {
    resultado.br = brotliCompressSync(buffer, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 }
    });
    resultado.gzip = gzipSync(buffer, { level: 9 });
  }
  cacheComprimido.set(clave, resultado);
  return resultado;
}

/** Un recurso con hash en el nombre (main-ABC123XY.js) nunca cambia: caché de 1 año. */
function cacheControl(archivo) {
  if (path.basename(archivo) === 'index.html') return 'no-cache';
  return /-[A-Z0-9]{8,}\.[a-z0-9]+$/i.test(path.basename(archivo))
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600';
}

function responder(req, res, archivo, codigo = 200) {
  const stats = statSync(archivo);
  const ext = path.extname(archivo).toLowerCase();
  const tipo = TIPOS[ext] || 'application/octet-stream';
  const acepta = String(req.headers['accept-encoding'] || '');

  const cabeceras = {
    'Content-Type': tipo,
    'Cache-Control': cacheControl(archivo),
    'X-Content-Type-Options': 'nosniff'
  };

  let buffer = null;
  if (COMPRIMIBLES.has(ext)) buffer = readFileSync(archivo);

  if (buffer) {
    const { br, gzip } = comprimir(archivo, buffer, stats.mtimeMs);
    if (br && acepta.includes('br')) {
      cabeceras['Content-Encoding'] = 'br';
      cabeceras['Vary'] = 'Accept-Encoding';
      cabeceras['Content-Length'] = br.length;
      res.writeHead(codigo, cabeceras);
      return res.end(req.method === 'HEAD' ? undefined : br);
    }
    if (gzip && acepta.includes('gzip')) {
      cabeceras['Content-Encoding'] = 'gzip';
      cabeceras['Vary'] = 'Accept-Encoding';
      cabeceras['Content-Length'] = gzip.length;
      res.writeHead(codigo, cabeceras);
      return res.end(req.method === 'HEAD' ? undefined : gzip);
    }
    cabeceras['Content-Length'] = buffer.length;
    res.writeHead(codigo, cabeceras);
    return res.end(req.method === 'HEAD' ? undefined : buffer);
  }

  cabeceras['Content-Length'] = stats.size;
  res.writeHead(codigo, cabeceras);
  if (req.method === 'HEAD') return res.end();
  createReadStream(archivo).pipe(res);
}

const servidor = http.createServer((req, res) => {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    ruta = '/';
  }

  const candidato = path.join(DIST, ruta);
  const dentroDeDist = candidato.startsWith(DIST);

  const archivo = dentroDeDist && existsSync(candidato) && statSync(candidato).isFile()
    ? candidato
    // SPA: cualquier ruta desconocida (p. ej. /menu/ventas) devuelve index.html
    // y Angular Router decide qué mostrar.
    : path.join(DIST, 'index.html');

  responder(req, res, archivo);
});

servidor.listen(PUERTO, HOST, () => {
  console.log(`\n🍰 Vista previa de PRODUCCIÓN en http://${HOST}:${PUERTO}`);
  console.log('   Bundle real (minificado + gzip/brotli). Audita ESTA URL con Lighthouse.\n');
});

process.on('SIGINT', () => servidor.close(() => process.exit(0)));
process.on('SIGTERM', () => servidor.close(() => process.exit(0)));
