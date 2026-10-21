/**
 * Pruebas del servicio de ventas: construcción de URLs de imágenes
 * (comprobantes y fotos de producto) y envío de la clave de idempotencia.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VentaService } from './venta.service';
import { environment } from '../../environments/environment';

describe('VentaService', () => {
  let servicio: VentaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    servicio = TestBed.inject(VentaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('urlImagen', () => {
    it('arma la URL absoluta de un archivo servido por el backend', () => {
      expect(servicio.urlImagen('/uploads/comprobantes/venta-12-1234.png')).toBe(
        `${servicio.baseArchivos}/uploads/comprobantes/venta-12-1234.png`
      );
    });

    it('la base de archivos es el API sin /api', () => {
      expect(servicio.baseArchivos).toBe(environment.apiUrl.replace(/\/api\/?$/, ''));
    });

    it('optimiza las fotos de Cloudinary (no descarga el original de ~1 MB)', () => {
      const url = servicio.urlImagen(
        'https://res.cloudinary.com/demo/image/upload/v1786000000/venta-12.jpg'
      );

      expect(url).toContain('/image/upload/');
      expect(url).toContain('w_600');
      expect(url).toContain('q_auto');
    });

    it('respeta una URL de Cloudinary que ya trae transformación escrita a mano', () => {
      const urlOriginal =
        'https://res.cloudinary.com/demo/image/upload/f_webp,q_auto,w_400/venta-12.jpg';

      expect(servicio.urlImagen(urlOriginal)).toBe(urlOriginal);
    });

    it('devuelve cadena vacía si no hay ruta (pedido sin comprobante)', () => {
      expect(servicio.urlImagen('')).toBe('');
    });
  });

  describe('listarDetalles', () => {
    it('pide los productos de un pedido a la ruta correcta', () => {
      servicio.listarDetalles(15).subscribe();

      const peticion = httpMock.expectOne(`${environment.apiUrl}/detalles-venta/venta/15`);
      expect(peticion.request.method).toBe('GET');
      peticion.flush([]);
    });
  });

  describe('crearVenta — idempotencia', () => {
    const payload = {
      id_cliente: null,
      tipo_comprobante: 'Boleta' as const,
      metodo_pago: 'Yape' as const,
      productos: [{ id_postre: 1, cantidad: 1 }]
    };

    it('envía la cabecera Idempotency-Key cuando se le pasa una clave', () => {
      servicio.crearVenta(payload, 'venta-abc-123').subscribe();

      const peticion = httpMock.expectOne(`${environment.apiUrl}/ventas`);
      expect(peticion.request.headers.get('Idempotency-Key')).toBe('venta-abc-123');
      peticion.flush({ status: 'success', message: 'ok', data: {} as never });
    });

    it('no envía la cabecera si no se le pasa clave', () => {
      servicio.crearVenta(payload).subscribe();

      const peticion = httpMock.expectOne(`${environment.apiUrl}/ventas`);
      expect(peticion.request.headers.has('Idempotency-Key')).toBeFalse();
      peticion.flush({ status: 'success', message: 'ok', data: {} as never });
    });
  });
});
