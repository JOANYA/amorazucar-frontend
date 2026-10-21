import { CarritoService } from './carrito.service';
import { Postre } from '../models/catalogo.model';

/**
 * El carrito guarda su contenido en localStorage para no perderlo al recargar.
 * Estas pruebas comprueban justamente eso: que se guarda, que se recupera en un
 * carrito nuevo y que un contenido manipulado o viejo no rompe los totales.
 *
 * Se instancia con `new` y no con TestBed a propósito: así cada prueba empieza
 * con un carrito realmente nuevo, que es exactamente el escenario a validar
 * (lo que hay en el navegador al volver a entrar).
 */
function postre(id: number, precio: number, stock = 10, nombre = `Postre ${id}`): Postre {
  return {
    id_postre: id,
    id_categoria: 1,
    nombre,
    descripcion: null,
    precio_actual: precio,
    stock_total: stock,
    estado: 'activo',
    imagen: null
  };
}

const CLAVE = 'azucaryamor_carrito';

describe('CarritoService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('arranca vacío cuando no hay nada guardado', () => {
    const carrito = new CarritoService();
    expect(carrito.snapshot).toEqual([]);
    expect(carrito.totalMonto).toBe(0);
  });

  it('suma cantidades y montos de varios productos', () => {
    const carrito = new CarritoService();
    carrito.agregar(postre(1, 18), 2);
    carrito.agregar(postre(2, 22), 1);

    expect(carrito.totalItems).toBe(3);
    expect(carrito.totalMonto).toBe(58);
  });

  it('agregar el mismo producto dos veces aumenta la cantidad, no lo duplica', () => {
    const carrito = new CarritoService();
    carrito.agregar(postre(1, 18));
    carrito.agregar(postre(1, 18));

    expect(carrito.snapshot.length).toBe(1);
    expect(carrito.snapshot[0].cantidad).toBe(2);
  });

  it('no deja pedir más unidades que el stock disponible', () => {
    const carrito = new CarritoService();
    carrito.agregar(postre(1, 18, 3));
    carrito.actualizarCantidad(1, 9);

    expect(carrito.snapshot[0].cantidad).toBe(3);
  });

  it('quitar un producto lo saca del carrito y del almacenamiento', () => {
    const carrito = new CarritoService();
    carrito.agregar(postre(1, 18));
    carrito.agregar(postre(2, 22));

    carrito.quitar(1);

    expect(carrito.snapshot.map((i) => i.postre.id_postre)).toEqual([2]);
    expect(JSON.parse(localStorage.getItem(CLAVE) ?? '[]').length).toBe(1);
  });

  it('RECUPERA el carrito guardado en un carrito nuevo (recargar la página)', () => {
    const primero = new CarritoService();
    primero.agregar(postre(1, 18, 10, 'Cheesecake de maracuyá'), 2);

    // Simula recargar: instancia nueva leyendo el mismo almacenamiento
    const segundo = new CarritoService();

    expect(segundo.snapshot.length).toBe(1);
    expect(segundo.snapshot[0].postre.nombre).toBe('Cheesecake de maracuyá');
    expect(segundo.snapshot[0].cantidad).toBe(2);
    expect(segundo.totalMonto).toBe(36);
  });

  it('vaciar deja el carrito y el almacenamiento sin nada (cerrar sesión)', () => {
    const carrito = new CarritoService();
    carrito.agregar(postre(1, 18));

    carrito.vaciar();

    expect(carrito.snapshot).toEqual([]);
    expect(JSON.parse(localStorage.getItem(CLAVE) ?? '[]')).toEqual([]);
    expect(new CarritoService().snapshot).toEqual([]);
  });

  it('descarta un carrito guardado con datos corruptos en lugar de romper los totales', () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify([
        { postre: { id_postre: 1, nombre: 'Ok', precio_actual: 18 }, cantidad: 2 },
        { postre: null, cantidad: 1 },
        { postre: { id_postre: 'x', nombre: 'Malo', precio_actual: 10 }, cantidad: 1 },
        { postre: { id_postre: 2, nombre: 'Sin precio', precio_actual: 'abc' }, cantidad: 1 },
        { postre: { id_postre: 3, nombre: 'Cantidad cero', precio_actual: 5 }, cantidad: 0 },
        'texto suelto'
      ])
    );

    const carrito = new CarritoService();

    expect(carrito.snapshot.length).toBe(1);
    expect(carrito.snapshot[0].postre.id_postre).toBe(1);
    expect(Number.isFinite(carrito.totalMonto)).toBeTrue();
    expect(carrito.totalMonto).toBe(36);
  });

  it('no revienta si lo guardado no es un JSON válido', () => {
    localStorage.setItem(CLAVE, '{esto no es json');

    const carrito = new CarritoService();

    expect(carrito.snapshot).toEqual([]);
    expect(carrito.totalMonto).toBe(0);
  });
});
