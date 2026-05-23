import { Component, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { IconFieldModule } from 'primeng/iconfield';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { AuthUser } from '../../../core/models/interface/auth-user';
import { PasswordTabSkipDirective } from '../../../shared/directives/password-tab-skip.directive';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { UserRoleEnum } from './../../../core/models/types/user-role';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    PasswordTabSkipDirective,
  ],
  providers: [MessageService],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnDestroy {
  form: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';
  rememberMe = false;

  // Solo visible con useMocks=true — oculto en producción
  readonly showQuickAccess = environment.useMocks;

  quickAccess = [
    { label: 'Admin', dni: '12345678' },
    { label: 'Vendedor', dni: '87654321' },
    { label: 'Cobrador', dni: '11223344' },
    { label: 'Vend./Cobrador', dni: '55667788' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthServiceBase,
    private router: Router,
  ) {
    this.form = this.fb.group({
      dni: [
        '',
        [
          Validators.required,
          Validators.minLength(7),
          Validators.maxLength(9),
          Validators.pattern(/^\d+$/),
        ],
      ],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get formControls() {
    return this.form.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.form.invalid) return;

    this.loading = true;
    this.auth
      .login(this.form.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => this.redirectByRole(user),
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.message ?? 'Credenciales incorrectas.';
        },
      });
  }

  goToForgotPassword(): void {
    this.router.navigate([AppRoutes.FORGOT_PASSWORD]);
  }

  quickLogin(dni: string): void {
    this.form.patchValue({ dni, password: 'mock123' });
    this.onSubmit();
  }

  private redirectByRole(user: AuthUser): void {
    this.loading = false;

    if (user.is_temp_password)
      return void this.router.navigate([AppRoutes.CHANGE_PASSWORD]);

    if (user.roles.includes(UserRoleEnum.ADMIN))
      return void this.router.navigate([AppRoutes.ADMIN, AppRoutes.DASHBOARD]);
    if (user.roles.includes(UserRoleEnum.SELLER))
      return void this.router.navigate([
        AppRoutes.SELLER,
        AppRoutes.OPERATIONS,
      ]);
    if (user.roles.includes(UserRoleEnum.COLLECTOR))
      return void this.router.navigate([AppRoutes.ROUTE]);
    if (user.roles.includes(UserRoleEnum.SELLER_COLLECTOR))
      return void this.router.navigate([
        AppRoutes.SELLER,
        AppRoutes.OPERATIONS,
      ]);

    this.router.navigate([AppRoutes.LOGIN]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
