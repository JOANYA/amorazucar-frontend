import { cloudinaryWebpSrcset, esUrlCloudinary, urlCloudinaryOptimizada } from './imagen-urls';

describe('imagen-urls', () => {
  const sinTransformar =
    'https://res.cloudinary.com/demo/image/upload/v1786600456/azucar-amor/postres/postre-1.jpg';

  it('inserta la transformación en una URL de Cloudinary sin transformar', () => {
    expect(urlCloudinaryOptimizada(sinTransformar, 600)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_600,c_limit/v1786600456/azucar-amor/postres/postre-1.jpg'
    );
  });

  it('redondea el ancho y acepta otro formato', () => {
    expect(urlCloudinaryOptimizada(sinTransformar, 399.6, 'f_webp')).toContain(
      'f_webp,q_auto,w_400,c_limit/'
    );
  });

  it('respeta una URL que YA trae transformación escrita a mano', () => {
    const yaTransformada =
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800/v1786600456/p.jpg';
    expect(urlCloudinaryOptimizada(yaTransformada, 400)).toBe(yaTransformada);
  });

  it('no toca URLs que no son de Cloudinary (Unsplash, rutas locales)', () => {
    const unsplash = 'https://images.unsplash.com/photo-1?w=500';
    expect(urlCloudinaryOptimizada(unsplash, 400)).toBe(unsplash);
    expect(urlCloudinaryOptimizada('/images/postres/01-torta-chocolate.jpg', 400)).toBe(
      '/images/postres/01-torta-chocolate.jpg'
    );
  });

  it('genera el srcset con los dos anchos en WebP', () => {
    const srcset = cloudinaryWebpSrcset(sinTransformar);
    expect(srcset).toContain('f_webp,q_auto,w_400,c_limit/');
    expect(srcset).toContain('f_webp,q_auto,w_800,c_limit/');
    expect(srcset).toContain('400w');
    expect(srcset).toContain('800w');
  });

  it('no genera srcset para imágenes que no son de Cloudinary', () => {
    expect(cloudinaryWebpSrcset('/images/postres/01-torta-chocolate.jpg')).toBeNull();
    expect(cloudinaryWebpSrcset('')).toBeNull();
  });

  it('detecta el origen de Cloudinary', () => {
    expect(esUrlCloudinary(sinTransformar)).toBeTrue();
    expect(esUrlCloudinary('/images/postres/01-torta-chocolate.jpg')).toBeFalse();
  });
});
