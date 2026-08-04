import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Postre } from '../models/catalogo.model';
import { ItemCarrito } from '../models/venta.model';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private itemsSubject = new BehaviorSubject<ItemCarrito[]>([]);
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
  }

  quitar(idPostre: number): void {
    this.itemsSubject.next(this.items.filter((i) => i.postre.id_postre !== idPostre));
  }

  vaciar(): void {
    this.itemsSubject.next([]);
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
}
