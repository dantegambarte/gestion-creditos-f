import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PasswordModule } from 'primeng/password';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { PasswordTabSkipDirective } from '../../../shared/directives/password-tab-skip.directive';
import { PortalAuthService } from '../auth/portal-auth.service';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPass = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return newPass && confirm && newPass !== confirm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-portal-change-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    PasswordModule,
    PasswordTabSkipDirective,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './portal-change-password.component.html',
})
export class PortalChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(PortalAuthService);
  private readonly router = inject(Router);

  readonly isTempPassword = this.auth.snapshot?.portalIsTempPassword ?? false;

  form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  loading = false;
  submitted = false;
  errorMessage = '';
  success = false;

  /**
   * Maneja el envío del formulario de cambio de contraseña.
   */
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.form.invalid) return;

    this.loading = true;
    const { currentPassword, newPassword } = this.form.getRawValue();

    this.auth
      .changePassword({
        current_password: currentPassword!,
        new_password: newPassword!,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          setTimeout(() => this.router.navigate([AppRoutes.PORTAL_DASHBOARD]), 1500);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.message ?? 'No se pudo cambiar la contraseña. Intentá de nuevo.';
        },
      });
  }
}
