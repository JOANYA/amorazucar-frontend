import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormBuilder } from '@angular/forms';

import { PerfilComponent, validarCambioPassword } from './perfil.component';
import { MapaSelectorComponent } from '../../shared/mapa-selector/mapa-selector.component';
import { AuthService } from '../../services/auth.service';
import { Perfil } from '../../models/perfil.model';

/**
 * Doble del mapa: las pruebas del perfil no deben cargar Leaflet ni pedir
 * tiles por internet. Solo necesita aceptar los inputs y poder emitir eventos.
 */
@Component({
  selector: 'app-mapa-selector',
  standalone: true,
  template: ''
})
class MapaSelectorFalso {
  @Input() latitud: number | null = null;
  @Input() longitud: number | null = null;
  @Output() ubicacionCambiada = new EventEmitter<{ latitud: number; longitud: number }>();
  @Output() direccionDetectada = new EventEmitter<string>();
}

const PERFIL: Perfil = {
  id_usuario: 7,
  dni: '12345678',
  nombre: 'Lucía',
  apellido: 'Mendoza',
  rol: 'cliente',
  estado: 'activo',
  telefono: '987654321',
  correo: 'lucia@example.com',
  direccion: null,
  latitud: null,
  longitud: null
};

describe('validarCambioPassword', () => {
  const fb = new FormBuilder();

  function grupo(actual: string, nueva: string, confirmar: string) {
    return fb.group(
      { actual, nueva, confirmar },
      { validators: validarCambioPassword }
    );
  }

  it('no marca error cuando la confirmación coincide', () => {
    expect(grupo('vieja123', 'nueva123', 'nueva123').errors).toBeNull();
  });

  it('marca error si la confirmación no coincide', () => {
    expect(grupo('vieja123', 'nueva123', 'otra123').errors?.['noCoinciden']).toBeTrue();
  });

  it('marca error si la contraseña nueva es igual a la actual', () => {
    expect(grupo('misma123', 'misma123', 'misma123').errors?.['igualALaActual']).toBeTrue();
  });
});

describe('PerfilComponent', () => {
  let fixture: ComponentFixture<PerfilComponent>;
  let componente: PerfilComponent;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'getUsuarioActual',
      'actualizarDatosLocales'
    ]);
    auth.getUsuarioActual.and.returnValue({
      id_usuario: 7,
      dni: '12345678',
      nombre: 'Lucía',
      apellido: 'Mendoza',
      rol: 'cliente',
      estado: 'activo'
    });

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth }
      ]
    })
      .overrideComponent(PerfilComponent, {
        remove: { imports: [MapaSelectorComponent] },
        add: { imports: [MapaSelectorFalso] }
      })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PerfilComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('carga el perfil y rellena el formulario', () => {
    const peticion = http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil');
    expect(peticion.request.method).toBe('GET');
    peticion.flush(PERFIL);
    fixture.detectChanges();

    expect(componente.cargando).toBeFalse();
    expect(componente.datosForm.get('nombre')?.value).toBe('Lucía');
    expect(componente.datosForm.get('telefono')?.value).toBe('987654321');
    expect(componente.latitud).toBeNull();
  });

  it('guarda los datos del formulario junto con el punto del mapa', () => {
    http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil').flush(PERFIL);
    fixture.detectChanges();

    // El cliente mueve el pin en el mapa y escribe la dirección
    componente.onUbicacionCambiada({ latitud: -12.0464, longitud: -77.0428 });
    componente.datosForm.patchValue({
      telefono: '999888777',
      direccion: 'Av. Arequipa 1250, Lima'
    });
    componente.guardarDatos();

    const peticion = http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body.latitud).toBe(-12.0464);
    expect(peticion.request.body.longitud).toBe(-77.0428);
    expect(peticion.request.body.direccion).toBe('Av. Arequipa 1250, Lima');
    expect(peticion.request.body.telefono).toBe('999888777');

    peticion.flush({
      mensaje: 'Perfil actualizado',
      perfil: {
        ...PERFIL,
        telefono: '999888777',
        direccion: 'Av. Arequipa 1250, Lima',
        latitud: -12.0464,
        longitud: -77.0428
      }
    });
    fixture.detectChanges();

    expect(componente.mensajeGuardado).toContain('Guardamos tus datos');
    // El menú saluda con el nombre guardado en la sesión: hay que refrescarlo
    expect(auth.actualizarDatosLocales).toHaveBeenCalled();
  });

  it('muestra el mensaje del backend cuando rechaza el guardado', () => {
    http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil').flush(PERFIL);
    fixture.detectChanges();

    componente.datosForm.patchValue({ direccion: '' });
    componente.onUbicacionCambiada({ latitud: -12.0464, longitud: -77.0428 });
    componente.guardarDatos();

    http
      .expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil')
      .flush(
        { status: 'error', message: 'Escribe la dirección que corresponde al punto del mapa.' },
        { status: 400, statusText: 'Bad Request' }
      );
    fixture.detectChanges();

    expect(componente.mensajeError).toContain('Escribe la dirección');
  });

  it('no pisa la dirección escrita por el cliente: la ofrece como sugerencia', () => {
    http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil').flush(PERFIL);
    fixture.detectChanges();

    componente.datosForm.patchValue({ direccion: 'Mi dirección escrita a mano' });
    componente.marcarDireccionManual();

    componente.onDireccionDetectada('Avenida Arequipa, Lince, Lima');

    expect(componente.datosForm.get('direccion')?.value).toBe('Mi dirección escrita a mano');
    expect(componente.sugerenciaMapa).toBe('Avenida Arequipa, Lince, Lima');

    componente.usarSugerenciaMapa();
    expect(componente.datosForm.get('direccion')?.value).toBe('Avenida Arequipa, Lince, Lima');
  });

  it('escribe la dirección del mapa cuando el campo está vacío', () => {
    http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil').flush(PERFIL);
    fixture.detectChanges();

    componente.onDireccionDetectada('Avenida Arequipa, Lince, Lima');

    expect(componente.datosForm.get('direccion')?.value).toBe('Avenida Arequipa, Lince, Lima');
    expect(componente.sugerenciaMapa).toBe('');
  });

  it('cambia la contraseña solo cuando los dos campos nuevos coinciden', () => {
    http.expectOne('http://127.0.0.1:3000/api/usuarios/7/perfil').flush(PERFIL);
    fixture.detectChanges();

    componente.passwordForm.patchValue({
      actual: 'vieja123',
      nueva: 'nueva123',
      confirmar: 'no-coincide'
    });
    componente.cambiarPassword();
    // No debe salir ninguna petición: el formulario es inválido
    http.expectNone('http://127.0.0.1:3000/api/usuarios/7/password');

    componente.passwordForm.patchValue({ confirmar: 'nueva123' });
    componente.cambiarPassword();

    const peticion = http.expectOne('http://127.0.0.1:3000/api/usuarios/7/password');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      password_actual: 'vieja123',
      password_nueva: 'nueva123'
    });

    peticion.flush({ mensaje: 'Contraseña actualizada' });
    fixture.detectChanges();

    expect(componente.mensajePassword).toContain('Contraseña actualizada');
    expect(componente.passwordForm.get('actual')?.value).toBeNull();
  });
});
