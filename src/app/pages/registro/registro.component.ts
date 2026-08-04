import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  registroForm: FormGroup;
  showPassword = false;
  isLoading = false;
  toastMessage = '';
  toastType: 'success' | 'error' | '' = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    // Sin control "rol": todo registro público entra como 'cliente'
    // (ver soloVentas en middlewares/auth.js). 'admin' y 'pastelero'
    // solo se crean por Postman.
    this.registroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      telefono: ['', [Validators.pattern(/^\d{9}$/)]],
      correo: ['', [Validators.email]],
      password_hash: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.registroForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
      this.toastType = '';
    }, 3500);
  }

  onSubmit(): void {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      this.showToast('❌ Revisa los campos marcados en rojo', 'error');
      return;
    }

    this.isLoading = true;

    const { nombre, apellido, dni, telefono, correo, password_hash } = this.registroForm.value;
    const payload = {
      dni,
      nombre,
      apellido,
      password_hash,
      rol: 'cliente' as const, // puede comprar (soloVentas)
      telefono: telefono ? telefono : null,
      correo: correo ? correo : null,
      estado: 'activo'
    };

    this.authService.registro(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.showToast('✅ Cuenta creada. ¡Ya puedes iniciar sesión!', 'success');
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.error || err.error?.mensaje || 'No se pudo crear la cuenta';
        this.showToast(`❌ ${msg}`, 'error');
      }
    });
  }
}
