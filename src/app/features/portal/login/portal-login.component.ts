import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { PortalAuthService } from '../auth/portal-auth.service';

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './portal-login.component.html',
})
export class PortalLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(PortalAuthService);
  private readonly router = inject(Router);

  form = this.fb.group({
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,9}$/)]],
    password: ['', Validators.required],
  });

  loading = false;
  submitted = false;
  errorMessage = '';
  failedAttempts = 0;
  readonly maxAttempts = 5;

  get isBlocked(): boolean {
    return this.failedAttempts >= this.maxAttempts;
  }

  /**
   * Maneja el envío del formulario de inicio de sesión.
   * @returns
   */
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.form.invalid || this.isBlocked) return;

    this.loading = true;
    this.auth
      .login(this.form.getRawValue() as { dni: string; password: string })
      .subscribe({
        next: () => {
          this.loading = false;
          this.failedAttempts = 0;
          this.router.navigate([AppRoutes.PORTAL_DASHBOARD]);
        },
        error: () => {
          this.loading = false;
          this.failedAttempts++;
          this.errorMessage = this.isBlocked
            ? 'Demasiados intentos fallidos. Recargá la página para intentar de nuevo.'
            : 'Credenciales incorrectas.';
        },
      });
  }
}
