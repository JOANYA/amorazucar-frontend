import { coordenadasLegibles, enlaceMapa } from './ubicacion-urls';

/**
 * Estas funciones arman el enlace con el que el admin abre en el mapa la
 * ubicación de un pedido. Si devolvieran una URL con un dato inválido, el
 * enlace llevaría a un mapa vacío o a ninguna parte, así que se prueban los
 * casos límite: sin coordenadas, con texto y fuera de rango.
 */
describe('ubicacion-urls', () => {
  describe('enlaceMapa', () => {
    it('arma el enlace de OpenStreetMap con el punto marcado', () => {
      const enlace = enlaceMapa(-12.0464, -77.0428);

      expect(enlace).toBe(
        'https://www.openstreetmap.org/?mlat=-12.0464&mlon=-77.0428#map=17/-12.0464/-77.0428'
      );
    });

    it('devuelve null cuando falta alguna coordenada', () => {
      expect(enlaceMapa(null, -77.0428)).toBeNull();
      expect(enlaceMapa(-12.0464, null)).toBeNull();
      expect(enlaceMapa(undefined, undefined)).toBeNull();
    });

    it('devuelve null si el valor no es un número', () => {
      expect(enlaceMapa(Number('no-es-numero'), -77.0428)).toBeNull();
      expect(enlaceMapa(NaN, NaN)).toBeNull();
    });

    it('rechaza coordenadas fuera del rango real del planeta', () => {
      expect(enlaceMapa(91, -77.0428)).toBeNull();
      expect(enlaceMapa(-12.0464, 181)).toBeNull();
      expect(enlaceMapa(-90, 180)).not.toBeNull();
    });

    it('acepta coordenadas que llegan como texto (MySQL devuelve DECIMAL así)', () => {
      expect(enlaceMapa('-12.0464000' as unknown as number, '-77.0428000' as unknown as number)).toBe(
        'https://www.openstreetmap.org/?mlat=-12.0464&mlon=-77.0428#map=17/-12.0464/-77.0428'
      );
    });

    it('acepta la latitud 0 sin confundirla con "sin ubicación"', () => {
      expect(enlaceMapa(0, 0)).toContain('mlat=0&mlon=0');
    });
  });

  describe('coordenadasLegibles', () => {
    it('muestra las coordenadas con seis decimales', () => {
      expect(coordenadasLegibles(-12.0464, -77.0428)).toBe('-12.046400, -77.042800');
    });

    it('devuelve null cuando no hay coordenadas utilizables', () => {
      expect(coordenadasLegibles(null, null)).toBeNull();
      expect(coordenadasLegibles(undefined, undefined)).toBeNull();
    });
  });
});
