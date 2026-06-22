import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
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
export class LoginComponent implements OnDestroy, AfterViewInit {
  private readonly REMEMBER_ME_KEY = 'sgcf_remember_me';
  private readonly REMEMBERED_DNI_KEY = 'sgcf_remembered_dni';
  @ViewChild('passwordField', { read: ElementRef })
  passwordField?: ElementRef<HTMLElement>;

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
    const remembered = this.readRememberedCredentials();
    this.rememberMe = remembered.rememberMe;

    this.form = this.fb.group({
      dni: [
        remembered.dni,
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

  /**
   * Envía las credenciales y guarda la preferencia de recordatorio de DNI.
   */
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.form.invalid) return;

    this.loading = true;
    this.auth
      .login(this.form.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.persistRememberedCredentials();
          this.redirectByRole(user);
        },
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

  /**
   * Enfoca contraseña automáticamente cuando hay DNI recordado.
   */
  ngAfterViewInit(): void {
    if (!this.rememberMe || !this.formControls['dni'].value) return;

    queueMicrotask(() => {
      const input = this.passwordField?.nativeElement.querySelector('input');
      if (input instanceof HTMLInputElement) {
        input.focus();
      }
    });
  }

  /**
   * Lee el estado de "Recuérdame" y el DNI recordado desde el navegador.
   * @returns {{ rememberMe: boolean; dni: string }} preferencia y valor inicial del formulario.
   */
  private readRememberedCredentials(): { rememberMe: boolean; dni: string } {
    if (typeof localStorage === 'undefined') {
      return { rememberMe: false, dni: '' };
    }

    const rememberMe = localStorage.getItem(this.REMEMBER_ME_KEY) === 'true';
    const dni = rememberMe ? (localStorage.getItem(this.REMEMBERED_DNI_KEY) ?? '') : '';
    return { rememberMe, dni };
  }

  /**
   * Persiste o limpia el DNI recordado según el estado del checkbox.
   */
  private persistRememberedCredentials(): void {
    if (typeof localStorage === 'undefined') return;

    if (this.rememberMe) {
      const dni = String(this.formControls['dni'].value ?? '');
      localStorage.setItem(this.REMEMBER_ME_KEY, 'true');
      localStorage.setItem(this.REMEMBERED_DNI_KEY, dni);
      return;
    }

    localStorage.removeItem(this.REMEMBER_ME_KEY);
    localStorage.removeItem(this.REMEMBERED_DNI_KEY);
  }
}
