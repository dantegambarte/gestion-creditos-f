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
import { AppError } from '../../../core/models/app-error';

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
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
    password: ['', Validators.required],
  });

  loading = false;
  submitted = false;
  errorMessage = '';
  /** true cuando el backend informó la cuenta bloqueada (ACCOUNT_LOCKED). */
  isBlocked = false;

  /**
   * Envía el login. El bloqueo por intentos fallidos lo decide el backend
   * (persiste aunque se recargue la página); acá sólo se muestra su código.
   */
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.form.invalid) return;

    this.loading = true;
    this.auth.login(this.form.getRawValue() as { dni: string; password: string }).subscribe({
      next: () => {
        this.loading = false;
        this.isBlocked = false;
        this.router.navigate([AppRoutes.PORTAL_DASHBOARD]);
      },
      error: (err: unknown) => {
        this.loading = false;
        this.applyLoginError(err);
      },
    });
  }

  /**
   * Traduce el error del login a un mensaje. Sólo un 401 son credenciales
   * inválidas; un corte de red o un 5xx no se presenta como intento fallido.
   * @param err - AppError devuelto por ApiHttpService ({ status, message, code })
   */
  private applyLoginError(err: unknown): void {
    const e = err as Partial<AppError> | null;
    this.isBlocked = e?.status === 401 && e.code === 'ACCOUNT_LOCKED';

    if (this.isBlocked) {
      this.errorMessage =
        e?.message ||
        'Tu cuenta fue bloqueada por seguridad. Comunicate con el negocio para reactivarla.';
    } else if (e?.status === 401) {
      this.errorMessage = 'Credenciales incorrectas.';
    } else if (e?.status === 0) {
      this.errorMessage = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
    } else {
      this.errorMessage = 'No pudimos iniciar sesión. Intentá de nuevo en unos minutos.';
    }
  }
}
