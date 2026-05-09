import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { AuthServiceBase } from '../../core/auth/auth-service.base';
import { AuthUser } from '../../core/models/interface/auth-user';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    AvatarModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    PasswordModule,
    DropdownModule,
    TagModule,
    InputSwitchModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  private destroy$ = new Subject<void>();

  personalForm!: FormGroup;
  passwordForm!: FormGroup;

  emailNotifications = true;
  darkMode = false;
  selectedLanguage = 'es';

  languages = [
    { label: 'Español', value: 'es' },
    { label: 'English', value: 'en' },
  ];

  loadingPersonal = false;
  loadingPassword = false;
  loadingPrefs = false;

  constructor(
    private auth: AuthServiceBase,
    private fb: FormBuilder,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.personalForm = this.fb.group({
        nombre: [user?.full_name ?? '', Validators.required],
        email: [{ value: user?.email ?? '', disabled: true }],
        telefono: ['+54 9 3885 123456'],
      });
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Devuelve una etiqueta legible para el rol del usuario actual, mapeando los roles técnicos a nombres más amigables. Si el usuario no tiene roles o el rol no está mapeado, devuelve el primer rol o una cadena vacía.
   */
  get roleLabel(): string {
    if (!this.currentUser) return '';
    const map: Record<string, string> = {
      ADMIN: 'Administrador',
      SELLER: 'Vendedor',
      COLLECTOR: 'Cobrador',
      SELLER_COLLECTOR: 'Vendedor/Cobrador',
      CASHIER: 'Cajero',
    };
    return map[this.currentUser.roles[0]] ?? this.currentUser.roles[0];
  }

  /**
   * Guarda los datos personales del usuario.
   * @returns
   */
  savePersonal(): void {
    if (this.personalForm.invalid) return;
    this.loadingPersonal = true;
    setTimeout(() => {
      this.loadingPersonal = false;
      this.messageService.add({
        severity: 'success',
        summary: 'Datos actualizados',
        detail: 'Los datos personales fueron guardados.',
      });
    }, 800);
  }

  /**
   * Cambia la contraseña del usuario.
   * @returns
   */
  changePassword(): void {
    if (this.passwordForm.invalid) return;
    const { newPassword, confirmPassword } = this.passwordForm.value;
    if (newPassword !== confirmPassword) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Las contraseñas no coinciden.',
      });
      return;
    }
    this.loadingPassword = true;
    setTimeout(() => {
      this.loadingPassword = false;
      this.passwordForm.reset();
      this.messageService.add({
        severity: 'success',
        summary: 'Contraseña cambiada',
        detail: 'Tu contraseña fue actualizada correctamente.',
      });
    }, 800);
  }

  /**
   * Guarda las preferencias del usuario, como notificaciones por email, modo oscuro e idioma. Simula una operación de guardado con un delay y muestra un mensaje de éxito al finalizar.
   */
  savePreferences(): void {
    this.loadingPrefs = true;
    setTimeout(() => {
      this.loadingPrefs = false;
      this.messageService.add({
        severity: 'success',
        summary: 'Preferencias guardadas',
        detail: 'Tus preferencias fueron actualizadas.',
      });
    }, 800);
  }

  /**
   * Cierra la sesión del usuario actual utilizando el servicio de autenticación y redirige al login. Esta función se ejecuta cuando el usuario hace clic en el botón de cerrar sesión, asegurando que se borre la sesión actual y se regrese a la pantalla de inicio de sesión.
   */
  logout(): void {
    this.auth.logout();
  }
}
