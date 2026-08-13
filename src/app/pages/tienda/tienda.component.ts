import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CatalogoService } from '../../services/catalogo.service';
import { CarritoService } from '../../services/carrito.service';
import { VentaService } from '../../services/venta.service';
import { AuthService } from '../../services/auth.service';
import { CategoriaService, Categoria } from '../../services/categoria.service';
import { Postre } from '../../models/catalogo.model';
import { ItemCarrito, MetodoPago } from '../../models/venta.model';

// El widget de Culqi Checkout (cargado en index.html vía <script src="https://checkout.culqi.com/js/v3">)
// se engancha al objeto global `Culqi` y llama a una función global llamada
// `culqi()` cuando el cliente termina de llenar el formulario de tarjeta
// (éxito o error). declare var evita que TypeScript se queje de que no
// conoce estos globales.
declare var Culqi: any;

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tienda.component.html',
  styleUrls: ['./tienda.component.css']
})
export class TiendaComponent implements OnInit {
  // --- Estado del Catálogo ---
  postres: Postre[] = [];
  cargando = false;
  errorCarga = '';

  // --- Estado del Carrito y Checkout ---
  carrito: ItemCarrito[] = [];
  mostrarCarrito = false;
  mostrarCheckout = false;
  metodoPago: MetodoPago = 'Yape';
  procesandoCompra = false;
  compraExitosa: { idVenta: number; montoTotal: number } | null = null;
  errorCompra = '';

  // --- Paso de comprobante (Yape/Plin Y Transferencia comparten este flujo) ---
  esperandoComprobante = false; // true = venta creada, falta subir la foto del pago
  archivoComprobante: File | null = null;
  previsualizacionComprobante = '';
  subiendoComprobante = false;
  errorComprobante = '';

  /** Datos de tu cuenta para que el cliente haga la transferencia desde su banca móvil. */
  datosBancarios = {
    banco: 'BCP',
    tipoCuenta: 'Cuenta de Ahorros',
    numeroCuenta: '000-00000000-0-00',
    cci: '00200000000000000000',
    titular: 'Azúcar & Amor'
  };

  // --- Paso de pago con tarjeta (Culqi) ---
  pagandoConTarjeta = false;
  pagoTarjetaCompletado = false;
  errorPagoTarjeta = '';

  // --- Estado del Módulo Admin (Crear / Editar Postre) ---
  mostrarModalCrear = false;
  modoEdicion = false;
  idPostreEditando: number | null = null;
  guardandoPostre = false;
  errorCrearPostre = '';

  nuevoPostre = {
    id_categoria: null as number | null,
    nombre: '',
    descripcion: '',
    precio_actual: null as number | null,
    stock_total: null as number | null
  };

  // Antes el formulario nunca enviaba id_categoria y el backend lo exige
  // (PostreService.crear/actualizar rechazan el postre sin categoría).
  categorias: Categoria[] = [];

  // --- Foto de producto (subida directa desde la tarjeta, solo admin) ---
  subiendoImagenId: number | null = null;

  constructor(
    private catalogoService: CatalogoService,
    private carritoService: CarritoService,
    private ventaService: VentaService,
    private authService: AuthService,
    private categoriaService: CategoriaService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarPostres();
    this.cargarCategorias();
    this.carritoService.items$.subscribe((items) => (this.carrito = items));
  }

  cargarCategorias(): void {
    this.categoriaService.listarCategorias().subscribe({
      next: (data) => (this.categorias = data),
      error: () => (this.categorias = [])
    });
  }

  // --- Métodos de Catálogo ---
  cargarPostres(): void {
  this.cargando = true;
  this.errorCarga = '';
  this.catalogoService.listarPostres().subscribe({
    next: (data) => {
      if (this.esAdmin) {
        this.postres = data;
      } else {
        const ESTADOS_OCULTOS = ['inactivo', 'agotado', 'eliminado', 'no disponible'];
        this.postres = data.filter(
          (p) => !ESTADOS_OCULTOS.includes(p.estado?.toLowerCase() ?? '') && p.stock_total > 0
        );
      }
      this.cargando = false;
    },
    error: (err) => {
      // IMPRIME EL ERROR REAL AQUÍ
      console.error('Error detallado al cargar catálogo:', err); 
      this.errorCarga = 'No se pudo cargar el catálogo de postres.';
      this.cargando = false;
    }
  });
}

  // --- Métodos del Carrito ---
  agregarAlCarrito(postre: Postre): void {
    this.carritoService.agregar(postre, 1);
    this.mostrarCarrito = true;
  }

  cambiarCantidad(idPostre: number, cantidad: number): void {
    this.carritoService.actualizarCantidad(idPostre, cantidad);
  }

  quitarDelCarrito(idPostre: number): void {
    this.carritoService.quitar(idPostre);
  }

  get totalCarrito(): number {
    return this.carritoService.totalMonto;
  }

  get totalItemsCarrito(): number {
    return this.carritoService.totalItems;
  }

  // --- Autenticación y Rol ---
  get estaAutenticado(): boolean {
    return this.authService.estaAutenticado();
  }

  get nombreUsuario(): string {
    const usuario = this.authService.getUsuarioActual();
    if (!usuario) return '';
    return usuario.nombre || usuario.dni || 'Usuario';
  }

  get esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  /** QR de Yape (assets del propio frontend, no cambian dinámicamente) */
  readonly yapeQrUrl = 'assets/pagos/yape-qr.jpeg';
  /** QR de Plin */
  readonly plinQrUrl = 'assets/pagos/plin-qr.jpeg';

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // --- Métodos de Checkout ---
  abrirCheckout(): void {
    if (this.carrito.length === 0) return;
    this.errorCompra = '';
    this.mostrarCheckout = true;
  }

  cerrarCheckout(): void {
    this.mostrarCheckout = false;
  }

  confirmarCompra(): void {
    const usuario = this.authService.getUsuarioActual();
    if (!usuario) {
      this.router.navigate(['/login']);
      return;
    }

    this.procesandoCompra = true;
    this.errorCompra = '';

    // Un solo POST /api/ventas: el backend crea la venta y agrega
    // todos los productos en el mismo llamado (registrarVenta hace el
    // loop de sp_AgregarDetalleVenta internamente). id_usuario NO se
    // envía: sale del token (req.usuario) en el backend.
    this.ventaService
      .crearVenta({
        id_cliente: null,
        tipo_comprobante: 'Boleta',
        metodo_pago: this.metodoPago,
        productos: this.carrito.map((item) => ({
          id_postre: item.postre.id_postre,
          cantidad: item.cantidad
        }))
      })
      .pipe(
        tap((respuesta) => {
          this.compraExitosa = {
            idVenta: respuesta.data.id_venta,
            montoTotal: respuesta.data.monto_total
          };
          this.carritoService.vaciar();

          // El pedido siempre queda "Pendiente" al crearse. Lo que cambia
          // es el siguiente paso según el método de pago:
          if (this.metodoPago === 'Yape' || this.metodoPago === 'Plin' || this.metodoPago === 'Transferencia') {
            // Los tres comparten el mismo flujo: mostrar cómo pagar (el QR
            // que corresponda, o los datos bancarios) y pedir la foto del
            // comprobante.
            this.esperandoComprobante = true;
          } else if (this.metodoPago === 'Tarjeta') {
            // Cobro real e inmediato con Culqi.
            this.abrirCulqiCheckout();
          }
          // Efectivo: no hace falta ningún paso extra, cae directo a la
          // pantalla de "pedido registrado, pendiente de confirmación".
        }),
        catchError((err) => {
          this.errorCompra =
            err.error?.message || err.error?.error || 'No se pudo completar la compra. Intenta nuevamente.';
          return of(null);
        })
      )
      .subscribe(() => {
        this.procesandoCompra = false;
      });
  }

  // --- Pago con tarjeta (Culqi) ---
  abrirCulqiCheckout(): void {
    if (!this.compraExitosa) return;
    this.errorPagoTarjeta = '';
    this.pagandoConTarjeta = true;

    Culqi.publicKey = environment.culqiPublicKey;
    Culqi.settings({
      title: 'Azúcar & Amor',
      currency: 'PEN',
      description: `Pedido #${this.compraExitosa.idVenta}`,
      amount: Math.round(this.compraExitosa.montoTotal * 100) // Culqi usa céntimos
    });

    // Culqi v3 llama a esta función global cuando el cliente termina de
    // llenar el formulario (éxito o error) -- se re-asigna cada vez que se
    // abre el checkout para que "recuerde" a qué pedido corresponde.
    (window as any).culqi = () => this.manejarRespuestaCulqi();

    Culqi.open();
  }

  private manejarRespuestaCulqi(): void {
    if (Culqi.token) {
      const tokenId = Culqi.token.id;
      const email = Culqi.token.email;

      this.ventaService.pagarConTarjeta(this.compraExitosa!.idVenta, tokenId, email).subscribe({
        next: () => {
          this.pagandoConTarjeta = false;
          this.pagoTarjetaCompletado = true;
        },
        error: (err) => {
          this.pagandoConTarjeta = false;
          this.errorPagoTarjeta = err.error?.message || 'No se pudo procesar el pago. Intenta de nuevo.';
        }
      });
    } else {
      // El cliente cerró el formulario de Culqi sin terminar, o la tarjeta
      // no pasó las validaciones del propio formulario (Culqi.error trae
      // el detalle). El pedido sigue "Pendiente" -- puede reintentar.
      this.pagandoConTarjeta = false;
      this.errorPagoTarjeta = Culqi.error?.user_message || 'No se completó el pago. Puedes intentar de nuevo.';
    }
  }

  // --- Comprobante de pago (Yape/Plin y Transferencia) ---
  seleccionarComprobante(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.archivoComprobante = archivo;
    this.errorComprobante = '';

    if (archivo) {
      const lector = new FileReader();
      lector.onload = (e) => (this.previsualizacionComprobante = e.target?.result as string);
      lector.readAsDataURL(archivo);
    } else {
      this.previsualizacionComprobante = '';
    }
  }

  subirComprobante(): void {
    if (!this.compraExitosa || !this.archivoComprobante) {
      this.errorComprobante = 'Adjunta la foto de tu comprobante de pago.';
      return;
    }

    this.subiendoComprobante = true;
    this.errorComprobante = '';

    this.ventaService.subirComprobante(this.compraExitosa.idVenta, this.archivoComprobante).subscribe({
      next: () => {
        this.subiendoComprobante = false;
        this.esperandoComprobante = false; // pasa a la pantalla final de "pedido registrado"
      },
      error: (err) => {
        this.subiendoComprobante = false;
        this.errorComprobante = err.error?.message || 'No se pudo subir el comprobante. Intenta nuevamente.';
      }
    });
  }

  cerrarConfirmacion(): void {
    this.compraExitosa = null;
    this.mostrarCheckout = false;
    this.mostrarCarrito = false;
    this.esperandoComprobante = false;
    this.archivoComprobante = null;
    this.previsualizacionComprobante = '';
    this.errorComprobante = '';
    this.pagandoConTarjeta = false;
    this.pagoTarjetaCompletado = false;
    this.errorPagoTarjeta = '';
    this.cargarPostres();
  }

  // --- Métodos Admin (CRUD Postres usando CatalogoService) ---
  abrirModalCrearPostre(): void {
    this.modoEdicion = false;
    this.idPostreEditando = null;
    this.errorCrearPostre = '';
    this.nuevoPostre = {
      id_categoria: this.categorias[0]?.id_categoria ?? null,
      nombre: '',
      descripcion: '',
      precio_actual: null,
      stock_total: null
    };
    this.mostrarModalCrear = true;
  }

  editarPostre(postre: Postre): void {
    this.modoEdicion = true;
    this.idPostreEditando = postre.id_postre;
    this.errorCrearPostre = '';
    this.nuevoPostre = {
      id_categoria: postre.id_categoria,
      nombre: postre.nombre,
      descripcion: postre.descripcion || '',
      precio_actual: postre.precio_actual,
      stock_total: postre.stock_total
    };
    this.mostrarModalCrear = true;
  }

  cerrarModalCrearPostre(): void {
    this.mostrarModalCrear = false;
  }

  guardarNuevoPostre(): void {
    if (
      !this.nuevoPostre.id_categoria ||
      !this.nuevoPostre.nombre ||
      !this.nuevoPostre.precio_actual ||
      this.nuevoPostre.stock_total === null
    ) {
      this.errorCrearPostre = 'Por favor completa todos los campos obligatorios (incluida la categoría).';
      return;
    }

    this.guardandoPostre = true;
    this.errorCrearPostre = '';

    const peticion$ = this.modoEdicion && this.idPostreEditando
      ? this.catalogoService.actualizarPostre(this.idPostreEditando, this.nuevoPostre)
      : this.catalogoService.crearPostre(this.nuevoPostre);

    peticion$.subscribe({
      next: () => {
        this.guardandoPostre = false;
        this.mostrarModalCrear = false;
        this.cargarPostres();
      },
      error: (err) => {
        this.guardandoPostre = false;
        // Antes se mostraba siempre el mismo texto genérico y se perdía el
        // motivo real que manda el backend (categoría inexistente, precio
        // inválido, etc.). Ahora se muestra el mensaje real cuando viene.
        this.errorCrearPostre =
          err.error?.error || err.error?.mensaje || 'Ocurrió un error al guardar el postre.';
      }
    });
  }

  eliminarPostre(idPostre: number) {
  if (!confirm('¿Estás seguro de que deseas eliminar este postre?')) return;

  // Llama a catalogoService en lugar de postreService
  this.catalogoService.eliminarPostre(idPostre).subscribe({
    next: () => {
      this.postres = this.postres.filter(p => p.id_postre !== idPostre);
      alert('Postre eliminado correctamente.');
    },
    error: (err: any) => {
      const mensaje = err.error?.message || 'No se pudo eliminar el postre.';
      alert(mensaje);
    }
  });
}

  // --- Foto de producto ---
  urlImagenPostre(ruta: string): string {
    return this.catalogoService.urlImagen(ruta);
  }

  seleccionarImagenPostre(event: Event, postre: Postre): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoImagenId = postre.id_postre;
    this.catalogoService.subirImagenPostre(postre.id_postre, archivo).subscribe({
      next: () => {
        this.subiendoImagenId = null;
        input.value = '';
        this.cargarPostres();
      },
      error: () => {
        this.subiendoImagenId = null;
        input.value = '';
        alert('No se pudo subir la foto del postre.');
      }
    });
  }
}