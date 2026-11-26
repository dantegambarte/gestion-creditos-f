import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PasswordModule } from 'primeng/password';
import { Subject, takeUntil } from 'rxjs';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { AppError } from '../../../core/models/app-error';
import { landingRouteForRoles } from '../../../core/auth/role-routes';
import { PasswordTabSkipDirective } from '../../../shared/directives/password-tab-skip.directive';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const newPwd = parent.get('new_password')?.value;
  return control.value === newPwd ? null : { mismatch: true };
}

@Component({
  selector: 'app-change-password',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    PasswordModule,
    IconFieldModule,
    InputIconModule,
    PasswordTabSkipDirective,
  ],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  form: FormGroup;
  loading = false;
  submitted = false;
  isTempPassword = false;
  currentPasswordError = '';
  newPasswordError = '';

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    readonly auth: AuthServiceBase,
    private router: Router,
  ) {
    this.form = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required, passwordMatchValidator]],
    });
  }

  ngOnInit(): void {
    this.isTempPassword = this.auth.snapshot?.is_temp_password ?? false;

    this.form
      .get('new_password')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.form.get('confirm_password')?.updateValueAndValidity();
      });
  }

  get f() {
    return this.form.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.currentPasswordError = '';
    this.newPasswordError = '';

    if (this.form.invalid) return;

    this.loading = true;
    const { current_password, new_password } = this.form.value;

    this.auth
      .changePassword(current_password, new_password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
        },
        error: (err: AppError) => {
          this.loading = false;
          if (err.status === 401) {
            this.currentPasswordError = err.message;
          } else if (err.status === 400) {
            this.newPasswordError = err.message;
          } else {
            this.newPasswordError = err.message ?? 'Error inesperado.';
          }
        },
      });
  }

  /** Vuelve a la ruta de aterrizaje absoluta del rol actual del usuario. */
  goBack(): void {
    this.router.navigate([landingRouteForRoles(this.auth.snapshot?.roles)]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
