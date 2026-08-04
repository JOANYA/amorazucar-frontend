import { Injectable } from '@angular/core';

export interface Entrega {
  id: number;
  cliente: string;
  distrito: string;
  imagenUrl: string;
  fecha: string;
}

@Injectable({
  providedIn: 'root'
})
export class EntregasService {
  private key = 'entregas_azucar_amor';

  // Fotos iniciales de muestra
  private entregasIniciales: Entrega[] = [
    {
      id: 1,
      cliente: 'Lucía M.',
      distrito: 'Miraflores',
      imagenUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
      fecha: '01/08/2026'
    },
    {
      id: 2,
      cliente: 'Carlos R.',
      distrito: 'Surco',
      imagenUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=500',
      fecha: '31/07/2026'
    }
  ];

  constructor() {
    if (!localStorage.getItem(this.key)) {
      localStorage.setItem(this.key, JSON.stringify(this.entregasIniciales));
    }
  }

  obtenerEntregas(): Entrega[] {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }

  agregarEntrega(nuevaEntrega: Omit<Entrega, 'id' | 'fecha'>): void {
    const entregas = this.obtenerEntregas();
    const nueva: Entrega = {
      ...nuevaEntrega,
      id: Date.now(),
      fecha: new Date().toLocaleDateString('es-PE')
    };
    entregas.unshift(nueva); // Agrega al inicio para que salga primero la más reciente
    localStorage.setItem(this.key, JSON.stringify(entregas));
  }

  eliminarEntrega(id: number): void {
    let entregas = this.obtenerEntregas();
    entregas = entregas.filter(item => item.id !== id);
    localStorage.setItem(this.key, JSON.stringify(entregas));
  }
}