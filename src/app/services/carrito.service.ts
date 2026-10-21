import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Postre } from '../models/catalogo.model';
import { ItemCarrito } from '../models/venta.model';

/**
 * ¿Este elemento guardado tiene la forma de un ItemCarrito usable?
 * Se comprueba campo por campo porque el contenido viene del navegador: puede
 * ser de una versión anterior de la app o haberlo editado alguien a mano.
 */
function esItemValido(elemento: unknown): elemento is ItemCarrito {
  const candidato = elemento as Partial<ItemCarrito> | null;
  const postre = candidato?.postre as Partial<Postre> | undefined;
  const cantidad = candidato?.cantidad;

  return (
    !!postre &&
    Number.isInteger(Number(postre.id_postre)) &&
    Number(postre.id_postre) > 0 &&
    typeof postre.nombre === 'string' &&
    Number.isFinite(Number(postre.precio_actual)) &&
    typeof cantidad === 'number' &&
    Number.isInteger(cantidad) &&
    cantidad > 0
  );
}

/** Clave del carrito guardado. Mismo prefijo que el resto de la app. */
const CLAVE_CARRITO = 'azucaryamor_carrito';

/**
 * Carrito de compras.
 *
 * PERSISTENCIA: el carrito se guarda en localStorage. Antes vivía solo en
 * memoria (el BehaviorSubject), así que recargar la página —o volver desde un
 * enlace— borraba todo lo que el cliente había elegido y tenía que empezar de
 * nuevo. Al cerrar sesión se vacía (ver AuthService.logout) para que el
 * siguiente usuario no herede productos de otro.
 *
 * Lo que se lee del almacenamiento se VALIDA: un localStorage se puede editar
 * a mano o quedar con datos de una versión anterior. Si viniera cualquier cosa,
 * `totalMonto` daría NaN y el pedido se enviaría con cantidades inválidas.
 */
@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private itemsSubject = new BehaviorSubject<ItemCarrito[]>(this.leerGuardado());
  items$ = this.itemsSubject.asObservable();

  private get items(): ItemCarrito[] {
    return this.itemsSubject.value;
  }

  agregar(postre: Postre, cantidad = 1): void {
    const existente = this.items.find((i) => i.postre.id_postre === postre.id_postre);

    if (existente) {
      this.actualizarCantidad(postre.id_postre, existente.cantidad + cantidad);
      return;
    }

    this.itemsSubject.next([...this.items, { postre, cantidad }]);
    this.guardar();
  }

  actualizarCantidad(idPostre: number, cantidad: number): void {
    if (cantidad <= 0) {
      this.quitar(idPostre);
      return;
    }

    const maximo = this.items.find((i) => i.postre.id_postre === idPostre)?.postre.stock_total ?? cantidad;
    const cantidadFinal = Math.min(cantidad, maximo);

    this.itemsSubject.next(
      this.items.map((i) => (i.postre.id_postre === idPostre ? { ...i, cantidad: cantidadFinal } : i))
    );
    this.guardar();
  }

  quitar(idPostre: number): void {
    this.itemsSubject.next(this.items.filter((i) => i.postre.id_postre !== idPostre));
    this.guardar();
  }

  vaciar(): void {
    this.itemsSubject.next([]);
    this.guardar();
  }

  get totalItems(): number {
    return this.items.reduce((acc, i) => acc + i.cantidad, 0);
  }

  get totalMonto(): number {
    return this.items.reduce((acc, i) => acc + i.cantidad * Number(i.postre.precio_actual), 0);
  }

  get snapshot(): ItemCarrito[] {
    return this.items;
  }

  /**
   * Escribe el carrito en el navegador.
   * Nunca lanza: en modo privado o con el almacenamiento lleno la compra debe
   * seguir funcionando, solo que sin recordar el carrito al recargar.
   */
  private guardar(): void {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(this.items));
    } catch {
      /* sin persistencia, pero el carrito sigue en memoria */
    }
  }

  /**
   * Lee y valida el carrito guardado. Se descarta cualquier elemento que no
   * tenga la forma esperada en lugar de confiar en el contenido del navegador.
   */
  private leerGuardado(): ItemCarrito[] {
    try {
      const crudo = localStorage.getItem(CLAVE_CARRITO);
      if (!crudo) return [];

      const datos: unknown = JSON.parse(crudo);
      if (!Array.isArray(datos)) return [];

      return datos.filter(esItemValido);
    } catch {
      return [];
    }
  }
}
