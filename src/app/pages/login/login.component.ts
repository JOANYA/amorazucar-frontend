import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  errorMessage = '';
  returnUrl: string = '/menu/ventas';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Definición de controles con ReactiveFormsModule
    this.loginForm = this.fb.group({
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      password_hash: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Captura la URL a la que quería ir antes de pedir Login (Ej: /tienda?autoComprar=true)
    // Si no hay ninguna, redirige a /tienda por defecto
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/menu/ventas';
  }

  // Getters para facilitar la lectura de validaciones en la plantilla HTML
  get dni() {
    return this.loginForm.get('dni');
  }

  get password_hash() {
    return this.loginForm.get('password_hash');
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading = false;

        // AuthService.login() ya guardó el token y el usuario, y ya
        // actualizó el estado de sesión (usuarioActual$). No hace falta
        // tocar localStorage aquí — hacerlo con otras claves ('token',
        // 'usuario') era justamente lo que rompía estaAutenticado().
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.error || err.error?.mensaje || 'Credenciales inválidas. Verifica tu DNI y contraseña.';
      }
    });
  }
}