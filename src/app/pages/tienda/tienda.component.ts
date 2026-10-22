import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, of, tap } from 'rxjs';

import { CatalogoService, PostrePayload } from '../../services/catalogo.service';
import { CarritoService } from '../../services/carrito.service';
import { VentaService } from '../../services/venta.service';
import { AuthService } from '../../services/auth.service';
import { PerfilService } from '../../services/perfil.service';
import { enlaceMapa } from '../../shared/ubicacion-urls';
import { CategoriaService, Categoria } from '../../services/categoria.service';
import { Postre } from '../../models/catalogo.model';
import { ItemCarrito, MetodoPago } from '../../models/venta.model';
import { IconoComponent } from '../../shared/icono/icono.component';

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconoComponent],
  templateUrl: './tienda.component.html',
  styleUrls: ['./tienda.component.css']
})
export class TiendaComponent implements OnInit {
  // --- Estado del Catálogo ---
  postres: Postre[] = [];
  cargando = false;
  errorCarga = '';

  /**
   * Dirección de entrega del cliente, leída de su perfil.
   * Se muestra en el checkout y viaja con el pedido; si está vacía, el cliente
   * puede comprar igual (lo recogemos o lo coordinamos por WhatsApp).
   */
  direccionEntrega: string | null = null;
  latitudEntrega: number | null = null;
  longitudEntrega: number | null = null;

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

  // --- Paso de pago con tarjeta (Mercado Pago) ---
  /** Generando el link de pago en Mercado Pago. */
  pagandoConTarjeta = false;
  errorPagoTarjeta = '';
  /** Link de pago devuelto por el backend (checkout de Mercado Pago). */
  linkMercadoPago: string | null = null;
  linkCopiado = false;

  // --- Estado del Módulo Admin (Crear / Editar Postre) ---
  mostrarModalCrear = false;
  /** Referencia al formulario de postre, para validar antes de guardar. */
  @ViewChild('formPostre') formPostre?: NgForm;
  modoEdicion = false;

  /**
   * Postre cuya eliminación está pendiente de confirmar.
   * Sustituye al confirm() nativo: el primer clic en 🗑️ pide confirmación y
   * el segundo la ejecuta.
   */
  idPostrePendienteEliminar: number | null = null;

  /** Aviso en pantalla de las acciones de administración. */
  mensajeAccion = '';
  mensajeAccionError = false;
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

  /**
   * Categoría seleccionada en el filtro del catálogo.
   * `null` = mostrar todos los postres.
   */
  categoriaSeleccionada: number | null = null;

  /**
   * Clave de idempotencia del intento de compra en curso.
   *
   * Se genera al abrir el checkout y se envía en la cabecera
   * `Idempotency-Key`. Si la red reintenta la petición o el usuario vuelve a
   * pulsar "Confirmar compra", el backend devuelve el MISMO pedido en vez de
   * crear uno duplicado. Solo se renueva cuando el carrito cambia.
   */
  private claveIdempotencia: string | null = null;

  // --- Foto de producto (subida directa desde la tarjeta, solo admin) ---
  subiendoImagenId: number | null = null;

  constructor(
    private catalogoService: CatalogoService,
    private carritoService: CarritoService,
    private ventaService: VentaService,
    private authService: AuthService,
    private categoriaService: CategoriaService,
    private perfilService: PerfilService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarPostres();
    this.cargarCategorias();
    this.cargarDireccionDeEntrega();
    this.carritoService.items$.subscribe((items) => {
      this.carrito = items;
      // Si el carrito cambia, el intento de compra anterior ya no aplica:
      // se descarta la clave de idempotencia para permitir un pedido nuevo.
      this.claveIdempotencia = null;
    });
  }

  /**
   * Lee la dirección de entrega del perfil del cliente.
   *
   * Se carga al entrar a la tienda (no al abrir el checkout) para que el modal
   * ya muestre la dirección en el primer pintado. Si falla, la compra sigue
   * siendo posible: el pedido quedaría sin dirección y el cliente la puede
   * registrar después en "Mi perfil".
   */
  cargarDireccionDeEntrega(): void {
    const usuario = this.authService.getUsuarioActual();
    if (!usuario?.id_usuario) return;

    this.perfilService.obtenerPerfil(usuario.id_usuario).subscribe({
      next: (perfil) => {
        this.direccionEntrega = perfil.direccion ?? null;
        this.latitudEntrega = perfil.latitud ?? null;
        this.longitudEntrega = perfil.longitud ?? null;
      },
      error: () => {
        this.direccionEntrega = null;
        this.latitudEntrega = null;
        this.longitudEntrega = null;
      }
    });
  }

  /** Enlace al mapa de la dirección de entrega (null si aún no hay punto). */
  get enlaceUbicacionEntrega(): string | null {
    return enlaceMapa(this.latitudEntrega, this.longitudEntrega);
  }

  // --- Filtro por categoría ---
  /** Postres que se muestran según la categoría elegida. */
  get postresFiltrados(): Postre[] {
    if (this.categoriaSeleccionada === null) return this.postres;
    return this.postres.filter((p) => Number(p.id_categoria) === Number(this.categoriaSeleccionada));
  }

  /** Cuántos postres hay en una categoría (para mostrarlo en el botón). */
  contarPorCategoria(idCategoria: number): number {
    return this.postres.filter((p) => Number(p.id_categoria) === Number(idCategoria)).length;
  }

  seleccionarCategoria(idCategoria: number | null): void {
    this.categoriaSeleccionada = idCategoria;
  }

  /** Genera (o reutiliza) la clave de idempotencia del intento de compra. */
  private obtenerClaveIdempotencia(): string {
    if (!this.claveIdempotencia) {
      const aleatorio =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      this.claveIdempotencia = `venta-${aleatorio}`;
    }
    return this.claveIdempotencia;
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

  /**
   * ¿Se está viendo el catálogo público (/tienda) o el módulo del menú
   * (/menu/ventas)?
   *
   * Es el mismo componente en las dos rutas, pero el encabezado cambia: en la
   * pública no hay menú lateral, así que la barra muestra la marca enlazada al
   * inicio y los botones de sesión en lugar del rótulo «Ventas».
   */
  get esVistaPublica(): boolean {
    return this.router.url.startsWith('/tienda');
  }

  get nombreUsuario(): string {
    const usuario = this.authService.getUsuarioActual();
    if (!usuario) return '';
    return usuario.nombre || usuario.dni || 'Usuario';
  }

  get esAdmin(): boolean {
    return this.authService.esAdmin();
  }

  /**
   * Puede gestionar el catálogo (crear/editar postres y subir fotos).
   * El backend lo permite a admin y pastelero (middleware soloPastelero),
   * así que la interfaz debe ofrecer lo mismo; antes solo se mostraba a admin.
   */
  get puedeAdministrarCatalogo(): boolean {
    return this.authService.puedeGestionarCatalogo();
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
      .crearVenta(
        {
          id_cliente: null,
          tipo_comprobante: 'Boleta',
          metodo_pago: this.metodoPago,
          productos: this.carrito.map((item) => ({
            id_postre: item.postre.id_postre,
            cantidad: item.cantidad
          })),
          // Dirección marcada en "Mi perfil": el pedido guarda una copia para
          // que el repartidor sepa dónde ir aunque el cliente se mude después.
          direccion_entrega: this.direccionEntrega,
          latitud_entrega: this.latitudEntrega,
          longitud_entrega: this.longitudEntrega
        },
        // Evita pedidos duplicados si se reintenta la misma compra
        this.obtenerClaveIdempotencia()
      )
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
            // Se genera el link de pago de Mercado Pago y se muestra con el monto.
            this.generarLinkMercadoPago();
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

  // --- Pago con tarjeta (Mercado Pago) ---
  /**
   * Pide al backend el link de pago de Mercado Pago para el pedido recién
   * creado. El pedido ya quedó registrado como "Pendiente": se confirma solo
   * cuando Mercado Pago avisa al backend (webhook) o cuando el cliente vuelve
   * a la página de resultado.
   */
  generarLinkMercadoPago(): void {
    if (!this.compraExitosa) return;
    this.errorPagoTarjeta = '';
    this.linkMercadoPago = null;
    this.pagandoConTarjeta = true;

    this.ventaService.pagarMercadoPago(this.compraExitosa.idVenta).subscribe({
      next: (resp) => {
        this.pagandoConTarjeta = false;
        if (resp.link_pago) {
          this.linkMercadoPago = resp.link_pago;
          // El monto que se muestra es el que el servidor cobrará.
          if (resp.monto_total !== undefined && this.compraExitosa) {
            this.compraExitosa = { ...this.compraExitosa, montoTotal: Number(resp.monto_total) };
          }
        }
      },
      error: (err) => {
        this.pagandoConTarjeta = false;
        this.errorPagoTarjeta =
          err.error?.message || 'No se pudo generar el link de pago. Intenta de nuevo.';
      }
    });
  }

  /** Lleva al cliente al checkout de Mercado Pago (en la misma pestaña, para que al terminar vuelva a la app). */
  irAMercadoPago(): void {
    if (this.linkMercadoPago) {
      window.location.href = this.linkMercadoPago;
    }
  }

  async copiarLinkMercadoPago(): Promise<void> {
    if (!this.linkMercadoPago) return;
    try {
      await navigator.clipboard.writeText(this.linkMercadoPago);
      this.linkCopiado = true;
      setTimeout(() => (this.linkCopiado = false), 2500);
    } catch {
      // Sin permiso de portapapeles: el link sigue visible para copiarlo a mano.
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
    this.errorPagoTarjeta = '';
    this.linkMercadoPago = null;
    this.linkCopiado = false;
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
    // Se usa la validez del formulario (NgForm) además de las comprobaciones
    // explícitas: el atributo `required`/`min` del HTML por sí solo NO bloquea
    // el envío en un formulario de plantilla.
    if (this.formPostre?.invalid) {
      this.errorCrearPostre =
        'Revisa los campos marcados: la categoría y el nombre son obligatorios, el precio debe ser mayor que 0 y el stock no puede ser negativo.';
      this.formPostre.form.markAllAsTouched();
      return;
    }

    const precio = Number(this.nuevoPostre.precio_actual);
    const stock = Number(this.nuevoPostre.stock_total);

    if (
      !this.nuevoPostre.id_categoria ||
      !this.nuevoPostre.nombre?.trim() ||
      this.nuevoPostre.precio_actual === null ||
      this.nuevoPostre.stock_total === null
    ) {
      this.errorCrearPostre = 'Por favor completa todos los campos obligatorios (incluida la categoría).';
      return;
    }
    // El atributo min="0.01" del HTML no impide escribir un negativo a mano.
    if (!Number.isFinite(precio) || precio <= 0) {
      this.errorCrearPostre = 'El precio debe ser mayor que 0.';
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      this.errorCrearPostre = 'El stock debe ser un número entero igual o mayor que 0.';
      return;
    }
    if (this.nuevoPostre.nombre.trim().length < 2) {
      this.errorCrearPostre = 'El nombre del postre debe tener al menos 2 caracteres.';
      return;
    }

    this.guardandoPostre = true;
    this.errorCrearPostre = '';

    // Payload normalizado: los campos ya fueron validados arriba, así que aquí
    // se envían con sus tipos definitivos (sin null).
    const payload: PostrePayload = {
      id_categoria: this.nuevoPostre.id_categoria as number,
      nombre: this.nuevoPostre.nombre.trim(),
      descripcion: this.nuevoPostre.descripcion?.trim() || null,
      precio_actual: precio,
      stock_total: stock
    };

    const peticion$ = this.modoEdicion && this.idPostreEditando
      ? this.catalogoService.actualizarPostre(this.idPostreEditando, payload)
      : this.catalogoService.crearPostre(payload);

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

  /**
   * Elimina (desactiva) un postre.
   * Antes usaba los diálogos nativos confirm()/alert(); ahora la confirmación
   * se pide con un aviso propio en pantalla.
   */
  eliminarPostre(idPostre: number) {
    if (this.idPostrePendienteEliminar !== idPostre) {
      this.idPostrePendienteEliminar = idPostre;
      this.mensajeAccion = 'Pulsa de nuevo el ícono 🗑️ para confirmar la eliminación.';
      this.mensajeAccionError = false;
      return;
    }

    this.idPostrePendienteEliminar = null;
    this.mensajeAccion = '';

    this.catalogoService.eliminarPostre(idPostre).subscribe({
      next: () => {
        this.postres = this.postres.filter(p => p.id_postre !== idPostre);
        this.mensajeAccion = 'Postre eliminado correctamente.';
        this.mensajeAccionError = false;
      },
      error: (err: any) => {
        this.mensajeAccion = err.error?.message || 'No se pudo eliminar el postre.';
        this.mensajeAccionError = true;
      }
    });
  }

  cancelarEliminacion(): void {
    this.idPostrePendienteEliminar = null;
    this.mensajeAccion = '';
  }

  // --- Foto de producto ---
  /** Foto de la tarjeta del catálogo. El ancho real es ~400 px, así que
   *  pedimos 600 px a Cloudinary: suficiente para pantallas de alta densidad y
   *  mucho más liviano que la foto original. */
  urlImagenPostre(ruta: string): string {
    return this.catalogoService.urlImagen(ruta, 600);
  }

  /**
   * Variantes WebP (400 y 800 px) de la foto de la tarjeta, para el <picture>.
   * El navegador elige según el tamaño real y la densidad de pantalla; el
   * <img> de respaldo sigue siendo la foto original.
   */
  webpSrcset(ruta: string): string | null {
    return this.catalogoService.webpSrcset(ruta);
  }

  seleccionarImagenPostre(event: Event, postre: Postre): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoImagenId = postre.id_postre;
    this.mensajeAccion = '';
    this.catalogoService.subirImagenPostre(postre.id_postre, archivo).subscribe({
      next: () => {
        this.subiendoImagenId = null;
        input.value = '';
        this.mensajeAccion = 'Foto del postre actualizada.';
        this.mensajeAccionError = false;
        this.cargarPostres();
      },
      error: (err) => {
        this.subiendoImagenId = null;
        input.value = '';
        this.mensajeAccion =
          err.error?.message ||
          err.error?.error ||
          'No se pudo subir la foto del postre. Revisa la configuración de Cloudinary.';
        this.mensajeAccionError = true;
      }
    });
  }
}