import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { environment } from '../../../environments/environment';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('el formulario debe ser inválido al estar vacío', () => {
    expect(component.loginForm.valid).toBeFalsy();
  });

  it('el DNI debe ser inválido si no tiene 8 dígitos', () => {
    const control = component.loginForm.get('dni');
    control?.setValue('123');
    expect(control?.errors?.['pattern']).toBeTruthy();
  });

  it('la contraseña debe ser inválida si tiene menos de 6 caracteres', () => {
    const control = component.loginForm.get('password_hash');
    control?.setValue('123');
    expect(control?.errors?.['minlength']).toBeTruthy();
  });

  it('no debe enviar la petición si el formulario es inválido', () => {
    component.onSubmit();
    httpMock.expectNone(`${environment.apiUrl}/usuarios/login`);
    expect(component.loginForm.touched).toBeTrue();
  });

  it('debe llamar a POST /api/usuarios/login y navegar al dashboard si el login es exitoso', () => {
    component.loginForm.setValue({ dni: '77777777', password_hash: '123456' });
    const navigateSpy = spyOn(router, 'navigate');

    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/usuarios/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dni: '77777777', password_hash: '123456' });

    req.flush({
      mensaje: 'Login exitoso',
      usuario: { id_usuario: 1, dni: '77777777', nombre: 'Ana', apellido: 'Perez', rol: 'vendedor', estado: 'activo' }
    });

    expect(component.isLoading).toBeFalse();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('debe mostrar un mensaje de error si el backend responde 401', () => {
    component.loginForm.setValue({ dni: '77777777', password_hash: '123456' });

    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/usuarios/login`);
    req.flush({ error: 'Credenciales inválidas o usuario inactivo' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toBe('Credenciales inválidas o usuario inactivo');
  });
});
