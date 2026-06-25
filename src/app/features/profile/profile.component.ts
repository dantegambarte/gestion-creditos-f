import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';

import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { AuthServiceBase } from '../../core/auth/auth-service.base';
import { ApiHttpService } from '../../core/http/api-http.service';
import { AppError } from '../../core/models/app-error';
import { AuthUser } from '../../core/models/interface/auth-user';
import { DateService } from '../../core/services/date.service';

interface UserProfile {
  id: string;
  full_name: string;
  dni: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  status: string;
  is_temp_password: boolean;
  failed_attempts: number;
  locked_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function passwordMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  return control.value === parent.get('newPassword')?.value
    ? null
    : { mismatch: true };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AvatarModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  profile: UserProfile | null = null;

  personalForm: FormGroup;
  passwordForm: FormGroup;

  loadingProfile = false;
  loadingPersonal = false;
  loadingPassword = false;
  submittedPersonal = false;
  submittedPassword = false;

  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthServiceBase,
    private api: ApiHttpService,
    private fb: FormBuilder,
    private dateService: DateService,
    private messageService: MessageService,
  ) {
    this.personalForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.email]],
      phone: [
        '',
        [Validators.pattern(/^[0-9+()\s-]{6,30}$/)],
      ],
      address: ['', [Validators.maxLength(255)]],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
    });
  }

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
    });

    this.passwordForm
      .get('newPassword')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.passwordForm.get('confirmPassword')?.updateValueAndValidity();
      });

    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Devuelve una etiqueta legible para el rol del usuario actual.
   */
  get roleLabel(): string {
    const role = this.profile?.role ?? this.currentUser?.roles[0] ?? '';
    const map: Record<string, string> = {
      ADMIN: 'Administrador',
      SELLER: 'Vendedor',
      COLLECTOR: 'Cobrador',
      SELLER_COLLECTOR: 'Vendedor/Cobrador',
      CASHIER: 'Cajero',
    };
    return map[role] ?? role;
  }

  /**
   * Devuelve una etiqueta legible para el estado del usuario.
   */
  get statusLabel(): string {
    return this.profile?.status === 'ACTIVE' ? 'Activo' : 'Inactivo';
  }

  /**
   * Obtiene los datos reales del perfil propio desde la API.
   */
  loadProfile(): void {
    this.loadingProfile = true;
    this.api
      .get<UserProfile>('users/me')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingProfile = false)),
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.personalForm.reset({
            full_name: profile.full_name,
            email: profile.email ?? '',
            phone: profile.phone ?? '',
            address: profile.address ?? '',
          });
          this.patchAuthUser(profile);
        },
        error: (err: AppError) => {
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo cargar el perfil',
            detail: err.message,
          });
        },
      });
  }

  /**
   * Guarda los datos personales editables del usuario logueado.
   */
  savePersonal(): void {
    this.submittedPersonal = true;
    if (this.personalForm.invalid) return;

    this.loadingPersonal = true;
    this.api
      .patch<UserProfile>('users/me', this.personalForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingPersonal = false)),
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.personalForm.markAsPristine();
          this.patchAuthUser(profile);
          this.messageService.add({
            severity: 'success',
            summary: 'Perfil actualizado',
            detail: 'Tus datos personales fueron guardados.',
          });
        },
        error: (err: AppError) => {
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo guardar',
            detail: err.message,
          });
        },
      });
  }

  /**
   * Cambia la contraseña sin salir de la pantalla de perfil.
   */
  changePassword(): void {
    this.submittedPassword = true;
    if (this.passwordForm.invalid) return;

    const { currentPassword, newPassword } = this.passwordForm.value;
    this.loadingPassword = true;

    this.api
      .patch<void>('users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingPassword = false)),
      )
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.submittedPassword = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Contraseña actualizada',
            detail: 'Tu contraseña fue cambiada correctamente.',
          });
        },
        error: (err: AppError) => {
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo cambiar la contraseña',
            detail: err.message,
          });
        },
      });
  }

  /**
   * Cierra la sesión del usuario actual.
   */
  logout(): void {
    this.auth.logout();
  }

  /**
   * Formatea una fecha ISO para mostrarla en la ficha del perfil.
   */
  displayDate(value?: string | null): string {
    if (!value) return 'Sin registro';
    return this.dateService.display(new Date(value), "d 'de' MMMM, yyyy HH:mm");
  }

  /**
   * Sincroniza los datos básicos editados con el usuario de sesión local.
   */
  private patchAuthUser(profile: UserProfile): void {
    this.auth.patchCurrentUser({
      full_name: profile.full_name,
      name: profile.full_name,
      avatar: this.initials(profile.full_name),
      dni: profile.dni ?? undefined,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      status: profile.status,
      last_login_at: profile.last_login_at,
      created_at: profile.created_at,
    });
  }

  /**
   * Genera las iniciales visibles en el avatar del perfil.
   */
  private initials(fullName: string): string {
    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }
}
