import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { RegistroComponent } from './registro.component';
import { environment } from '../../../environments/environment';

describe('RegistroComponent', () => {
  let component: RegistroComponent;
  let fixture: ComponentFixture<RegistroComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('el formulario debe ser inválido al estar vacío', () => {
    expect(component.registroForm.valid).toBeFalsy();
  });

  it('el formulario no debe tener un control de rol (el rol lo decide el backend)', () => {
    expect(component.registroForm.get('rol')).toBeNull();
  });

  it('no debe enviar la petición si el formulario es inválido', () => {
    component.onSubmit();
    httpMock.expectNone(`${environment.apiUrl}/usuarios/registro`);

    // Además de no enviar nada, debe avisar al usuario y marcar los campos
    // para que los errores se vean en rojo (no fallar en silencio).
    expect(component.registroForm.touched).toBeTrue();
    expect(component.toastType).toBe('error');
    expect(component.toastMessage).toContain('Revisa los campos');
  });

  // El backend fuerza el rol 'cliente' al registrar desde el formulario público
  // (antes se podía enviar 'vendedor'/'admin' y escalar privilegios). Esta
  // prueba pedía 'vendedor', que era justamente el agujero ya corregido.
  it('debe enviar siempre rol "cliente" en POST /api/usuarios/registro', () => {
    component.registroForm.setValue({
      nombre: 'Ana',
      apellido: 'Torres',
      dni: '77777777',
      telefono: '',
      correo: '',
      password_hash: '123456'
    });
    const navigateSpy = spyOn(router, 'navigate');

    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/usuarios/registro`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      dni: '77777777',
      nombre: 'Ana',
      apellido: 'Torres',
      password_hash: '123456',
      rol: 'cliente',
      telefono: null,
      correo: null,
      estado: 'activo'
    });

    req.flush({ mensaje: 'Usuario creado exitosamente', resultado: { id_usuario: 10 } });

    expect(component.isLoading).toBeFalse();
    expect(component.toastType).toBe('success');
  });

  it('debe mostrar un toast de error si el DNI ya existe', () => {
    component.registroForm.setValue({
      nombre: 'Ana',
      apellido: 'Torres',
      dni: '77777777',
      telefono: '',
      correo: '',
      password_hash: '123456'
    });

    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/usuarios/registro`);
    req.flush({ error: 'El DNI ya se encuentra registrado' }, { status: 500, statusText: 'Server Error' });

    expect(component.isLoading).toBeFalse();
    expect(component.toastType).toBe('error');
    expect(component.toastMessage).toContain('El DNI ya se encuentra registrado');
  });
});
