import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { PerfilService } from '../../services/perfil.service';
import { Perfil } from '../../models/perfil.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { MapaSelectorComponent } from '../../shared/mapa-selector/mapa-selector.component';

/** Celular peruano: 9 dígitos, igual que valida el registro y el backend. */
const REGEX_TELEFONO = /^\d{9}$/;
const LARGO_DIRECCION = 200;

/**
 * Validador del formulario de contraseña.
 *
 * Se exporta para poder probarlo sin montar el componente completo. Cubre los
 * dos errores que el backend también rechaza: que la confirmación no coincida y
 * que la contraseña nueva sea la misma que la actual.
 */
export function validarCambioPassword(grupo: AbstractControl): ValidationErrors | null {
  const actual = grupo.get('actual')?.value;
  const nueva = grupo.get('nueva')?.value;
  const confirmar = grupo.get('confirmar')?.value;

  const errores: ValidationErrors = {};

  if (nueva && confirmar && nueva !== confirmar) {
    errores['noCoinciden'] = true;
  }
  if (nueva && actual && nueva === actual) {
    errores['igualALaActual'] = true;
  }

  return Object.keys(errores).length > 0 ? errores : null;
}

/**
 * "Mi perfil": el cliente edita sus datos de contacto, marca en el mapa dónde
 * quiere recibir sus pedidos y cambia su contraseña.
 *
 * El DNI, el rol y el estado se muestran pero no se editan: identifican la
 * cuenta y son administrativos. La contraseña vive en su propio formulario
 * porque el backend exige escribir la actual.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconoComponent, MapaSelectorComponent],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  cargando = true;
  errorCarga = '';

  perfil: Perfil | null = null;
  idUsuario: number | null = null;

  guardando = false;
  mensajeGuardado = '';
  mensajeError = '';
  intentoGuardado = false;

  latitud: number | null = null;
  longitud: number | null = null;

  /** Dirección que propuso el mapa cuando el campo ya tenía texto escrito. */
  sugerenciaMapa = '';
  /**
   * true mientras el texto del campo lo puso el mapa. Sirve para decidir si se
   * puede reemplazar solo: si el cliente escribió su propia dirección, no se
   * pisa lo que escribió; se le ofrece la sugerencia con un botón.
   */
  direccionVinoDelMapa = false;

  guardandoPassword = false;
  mensajePassword = '';
  errorPassword = '';
  intentoPassword = false;

  datosForm: FormGroup;
  passwordForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private perfilService: PerfilService
  ) {
    this.datosForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      telefono: ['', [Validators.pattern(REGEX_TELEFONO)]],
      correo: ['', [Validators.email]],
      direccion: ['', [Validators.maxLength(LARGO_DIRECCION)]]
    });

    this.passwordForm = this.fb.group(
      {
        actual: ['', [Validators.required]],
        nueva: ['', [Validators.required, Validators.minLength(6)]],
        confirmar: ['', [Validators.required]]
      },
      { validators: validarCambioPassword }
    );
  }

  ngOnInit(): void {
    const usuario = this.authService.getUsuarioActual();
    this.idUsuario = usuario?.id_usuario ?? null;

    if (!this.idUsuario) {
      this.cargando = false;
      this.errorCarga = 'No pudimos identificar tu cuenta. Vuelve a iniciar sesión.';
      return;
    }

    this.perfilService.obtenerPerfil(this.idUsuario).subscribe({
      next: (perfil) => {
        this.aplicarPerfil(perfil);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.errorCarga = 'No se pudo cargar tu perfil. Recarga la página e inténtalo otra vez.';
      }
    });
  }

  private aplicarPerfil(perfil: Perfil): void {
    this.perfil = perfil;
    this.latitud = perfil.latitud ?? null;
    this.longitud = perfil.longitud ?? null;

    this.datosForm.patchValue({
      nombre: perfil.nombre ?? '',
      apellido: perfil.apellido ?? '',
      telefono: perfil.telefono ?? '',
      correo: perfil.correo ?? '',
      direccion: perfil.direccion ?? ''
    });

    // La dirección que ya estaba guardada es "del mapa" en el sentido de que
    // puede reemplazarse sola la próxima vez que muevan el pin.
    this.direccionVinoDelMapa = true;
  }

  get telefono() { return this.datosForm.get('telefono'); }
  get correo() { return this.datosForm.get('correo'); }
  get direccion() { return this.datosForm.get('direccion'); }

  /** El cliente escribió a mano: su texto manda sobre lo que proponga el mapa. */
  marcarDireccionManual(): void {
    this.direccionVinoDelMapa = false;
  }

  /** El pin se movió: se guardan las coordenadas, sin tocar el texto. */
  onUbicacionCambiada(punto: { latitud: number; longitud: number }): void {
    this.latitud = punto.latitud;
    this.longitud = punto.longitud;
  }

  /**
   * El mapa resolvió una dirección.
   * Si el campo está vacío o su texto lo puso el propio mapa, se actualiza; si
   * el cliente escribió algo, se le ofrece como sugerencia en vez de pisarlo.
   */
  onDireccionDetectada(texto: string): void {
    const limpio = (texto ?? '').trim();
    if (!limpio) return;

    const control = this.datosForm.get('direccion');
    const actual = String(control?.value ?? '').trim();

    if (!actual || this.direccionVinoDelMapa) {
      control?.setValue(limpio.slice(0, LARGO_DIRECCION));
      this.direccionVinoDelMapa = true;
      this.sugerenciaMapa = '';
    } else {
      this.sugerenciaMapa = limpio;
    }
  }

  usarSugerenciaMapa(): void {
    this.datosForm.get('direccion')?.setValue(this.sugerenciaMapa.slice(0, LARGO_DIRECCION));
    this.direccionVinoDelMapa = true;
    this.sugerenciaMapa = '';
  }

  descartarSugerencia(): void {
    this.sugerenciaMapa = '';
  }

  guardarDatos(): void {
    this.intentoGuardado = true;
    this.mensajeGuardado = '';
    this.mensajeError = '';

    if (this.datosForm.invalid || !this.idUsuario) {
      this.datosForm.markAllAsTouched();
      return;
    }

    const valores = this.datosForm.value;

    this.guardando = true;
    this.perfilService
      .actualizarPerfil(this.idUsuario, {
        nombre: String(valores.nombre).trim(),
        apellido: String(valores.apellido).trim(),
        telefono: valores.telefono ? String(valores.telefono).trim() : null,
        correo: valores.correo ? String(valores.correo).trim() : null,
        direccion: valores.direccion ? String(valores.direccion).trim() : null,
        latitud: this.latitud,
        longitud: this.longitud
      })
      .subscribe({
        next: (respuesta) => {
          this.guardando = false;
          this.aplicarPerfil(respuesta.perfil);
          this.mensajeGuardado = 'Guardamos tus datos. Ya usaremos esta dirección en tus pedidos.';

          // El nombre con el que saluda el menú sale del usuario en sesión:
          // si no se actualiza aquí, seguiría mostrando el anterior.
          this.authService.actualizarDatosLocales({
            nombre: respuesta.perfil.nombre,
            apellido: respuesta.perfil.apellido,
            telefono: respuesta.perfil.telefono,
            correo: respuesta.perfil.correo
          });
        },
        error: (err) => {
          this.guardando = false;
          this.mensajeError =
            err.error?.message || err.error?.error || 'No se pudieron guardar tus datos.';
        }
      });
  }

  cambiarPassword(): void {
    this.intentoPassword = true;
    this.mensajePassword = '';
    this.errorPassword = '';

    if (this.passwordForm.invalid || !this.idUsuario) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { actual, nueva } = this.passwordForm.value;

    this.guardandoPassword = true;
    this.perfilService
      .cambiarPassword(this.idUsuario, {
        password_actual: actual,
        password_nueva: nueva
      })
      .subscribe({
        next: () => {
          this.guardandoPassword = false;
          this.passwordForm.reset();
          this.intentoPassword = false;
          this.mensajePassword = 'Contraseña actualizada. Úsala la próxima vez que entres.';
        },
        error: (err) => {
          this.guardandoPassword = false;
          this.errorPassword =
            err.error?.message || err.error?.error || 'No se pudo cambiar la contraseña.';
        }
      });
  }
}
