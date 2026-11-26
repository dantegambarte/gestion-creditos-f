import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, IconFieldModule, InputIconModule],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = false;
  submitted = false;
  sent = false;
  /** True tras enviar: la recuperación por email aún no existe en el backend. */
  unavailable = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  /**
   * Valida el email e informa que la recuperación automática no está disponible.
   * El backend no expone un endpoint de recuperación, así que no se simula un envío exitoso.
   */
  onSubmit(): void {
    this.submitted = true;
    if (this.form.invalid) return;
    this.sent = false;
    this.unavailable = true;
  }

  goBack(): void {
    this.router.navigate([AppRoutes.LOGIN]);
  }
}
