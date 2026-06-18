import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import { HeaderService } from '../../../../core/services/header.service';
import { TempPasswordDialogComponent } from '../../../../shared/components/temp-password-dialog/temp-password-dialog.component';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import { UsersService } from '../users.service';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    ToastModule,
    TempPasswordDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './user-create.component.html',
})
export class UserCreateComponent implements OnInit {
  @Input() isModal = false;
  @Output() created = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  submitting = false;
  showTempPasswordDialog = false;
  tempPassword = '';
  private createdUserId = '';

  readonly roleOptions = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Vendedor', value: 'SELLER' },
    { label: 'Cobrador', value: 'COLLECTOR' },
    { label: 'Vendedor/Cobrador', value: 'SELLER_COLLECTOR' },
  ];

  ngOnInit(): void {
    if (!this.isModal) {
      this.header.set([
        { label: 'Usuarios', route: '/admin/users' },
        { label: 'Nuevo usuario' },
      ]);
    }

    this.form = this.fb.group({
      fullName: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,9}$/)]],
      email: ['', [Validators.email]],
      address: ['', [Validators.maxLength(255)]],
      role: ['', [Validators.required]],
    });
  }

  /**
   * Valida si un campo del formulario es inválido y ha sido tocado o modificado.
   * @param field
   * @returns
   */
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /**
   * Devuelve el mensaje de error correspondiente para un campo del formulario, basado en las validaciones fallidas.
   * Si el error proviene del backend (status 409), se muestra el mensaje específico retornado por el servidor.
   * Para errores de validación del frontend, se muestran mensajes predefinidos según el tipo de error (requerido, longitud, formato, etc.).
   * @param field
   * @returns
   */
  getError(field: string): string {
    const c = this.form.get(field);
    if (!c?.errors) return '';
    if (c.errors['serverError']) return c.errors['serverError'];
    if (c.errors['required']) return 'Este campo es requerido.';
    if (c.errors['minlength'])
      return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength'])
      return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    if (c.errors['email']) return 'Formato de email inválido.';
    if (c.errors['pattern']) {
      if (field === 'dni')
        return 'El DNI debe contener entre 7 y 9 dígitos numéricos.';
      return 'Solo se permiten letras y espacios.';
    }
    return 'Campo inválido.';
  }

  /**
   * Envía el formulario para crear un nuevo usuario. Si el formulario es inválido, marca todos los campos como tocados para mostrar los errores de validación.
   * Si el formulario es válido, llama al servicio de usuarios para crear el nuevo usuario con los datos del formulario.
   * Maneja la respuesta del servidor: si la creación es exitosa, muestra el diálogo con la contraseña temporal;
   * @returns
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const raw = this.form.getRawValue();

    this.usersService
      .create({
        fullName: raw.fullName,
        dni: raw.dni,
        email: raw.email || undefined,
        address: raw.address || undefined,
        role: raw.role,
      })
      .subscribe({
        next: ({ user, tempPassword }) => {
          this.submitting = false;
          this.createdUserId = user.id;
          this.tempPassword = tempPassword;
          this.showTempPasswordDialog = true;
        },
        error: (err: AppError) => {
          this.submitting = false;
          if (err.status === 409) {
            const msg: string = err.message ?? '';
            if (msg.toLowerCase().includes('email')) {
              this.form.get('email')!.setErrors({ serverError: msg });
              this.form.get('email')!.markAsDirty();
            } else {
              this.form.get('dni')!.setErrors({ serverError: msg });
              this.form.get('dni')!.markAsDirty();
            }
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message,
            });
          }
        },
      });
  }

  /**
   * Cierra el diálogo de contraseña temporal. En modo modal emite el evento `created`; en modo página redirige al detalle del usuario.
   */
  onTempPasswordClosed(): void {
    this.showTempPasswordDialog = false;
    this.tempPassword = '';
    if (this.isModal) {
      this.created.emit();
    } else {
      this.router.navigate([
        '/',
        AppRoutes.ADMIN,
        AppRoutes.USERS,
        this.createdUserId,
      ]);
    }
  }

  /**
   * Cancela la creación del usuario. En modo modal emite el evento `cancelled`; en modo página redirige a la lista.
   */
  cancel(): void {
    if (this.isModal) {
      this.cancelled.emit();
    } else {
      this.router.navigate(['/', AppRoutes.ADMIN, AppRoutes.USERS]);
    }
  }
}
