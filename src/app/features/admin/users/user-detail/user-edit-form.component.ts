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
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { AppError } from '../../../../core/models/app-error';
import { UserRole } from '../../../../core/models/types/user-role';
import { UserDetail, UserUpdatePayload } from '../user.model';
import { UsersService } from '../users.service';

@Component({
  selector: 'app-user-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, DropdownModule, InputTextModule],
  templateUrl: './user-edit-form.component.html',
})
export class UserEditFormComponent implements OnInit {
  @Input() user!: UserDetail;
  /** Emite el usuario actualizado cuando el guardado es exitoso. */
  @Output() saved = new EventEmitter<UserDetail>();
  /** Emite cuando el usuario cancela la edición. */
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly msg = inject(MessageService);

  editForm!: FormGroup;
  saving = false;

  private originalRole: UserRole | null = null;
  private originalFormSnapshot: Record<string, unknown> = {};

  readonly roleOptions = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Vendedor', value: 'SELLER' },
    { label: 'Cobrador', value: 'COLLECTOR' },
    { label: 'Vendedor/Cobrador', value: 'SELLER_COLLECTOR' },
  ];

  /**
   * Indica si el rol fue modificado respecto al valor original.
   */
  get roleChanged(): boolean {
    return (
      !!this.editForm && this.editForm.get('role')?.value !== this.originalRole
    );
  }

  /**
   * True si el formulario tiene valores distintos al snapshot original.
   * Reemplaza editForm.dirty que no revierte cuando el valor vuelve al original.
   */
  get formHasChanges(): boolean {
    if (!this.editForm) return false;
    const current = this.editForm.getRawValue();
    return Object.keys(current).some(
      (k) => current[k] !== this.originalFormSnapshot[k],
    );
  }

  ngOnInit(): void {
    this.originalRole = this.user.role;
    this.editForm = this.fb.group({
      fullName: [
        this.user.fullName,
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      dni: [
        this.user.dni,
        [Validators.required, Validators.pattern(/^\d{7,8}$/)],
      ],
      email: [this.user.email ?? '', [Validators.email]],
      address: [this.user.address ?? '', [Validators.maxLength(255)]],
      role: [this.user.role, [Validators.required]],
    });
    this.originalFormSnapshot = this.editForm.getRawValue();
  }

  /**
   * Envía el formulario. Maneja conflictos 409 con errores de campo; en éxito emite saved.
   * @returns
   */
  onSubmit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const raw = this.editForm.getRawValue();
    const payload: UserUpdatePayload = {
      fullName: raw.fullName,
      dni: raw.dni,
      email: raw.email || undefined,
      address: raw.address || undefined,
      role: raw.role,
    };

    this.usersService.update(this.user.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.saved.emit(updated);
      },
      error: (err: AppError) => {
        this.saving = false;
        if (err.status === 409) {
          const msg: string = err.message ?? '';
          if (msg.toLowerCase().includes('email')) {
            this.editForm.get('email')!.setErrors({ serverError: msg });
            this.editForm.get('email')!.markAsDirty();
          } else if (msg.toLowerCase().includes('dni')) {
            this.editForm.get('dni')!.setErrors({ serverError: msg });
            this.editForm.get('dni')!.markAsDirty();
          } else {
            this.msg.add({
              severity: 'warn',
              summary: 'Conflicto',
              detail: msg,
            });
          }
        } else {
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message,
          });
        }
      },
    });
  }

  /**
   * Indica si un campo del formulario es inválido y fue tocado o modificado.
   * @param field Nombre del campo
   */
  isInvalid(field: string): boolean {
    const c = this.editForm?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /**
   * Devuelve el mensaje de error para un campo del formulario.
   * @param field Nombre del campo
   */
  getError(field: string): string {
    const camp = this.editForm?.get(field);
    if (!camp?.errors) return '';
    if (camp.errors['serverError']) return camp.errors['serverError'];
    if (camp.errors['required']) return 'Este campo es requerido.';
    if (camp.errors['minlength'])
      return `Mínimo ${camp.errors['minlength'].requiredLength} caracteres.`;
    if (camp.errors['maxlength'])
      return `Máximo ${camp.errors['maxlength'].requiredLength} caracteres.`;
    if (camp.errors['email']) return 'Formato de email inválido.';
    if (camp.errors['pattern']) {
      if (field === 'dni')
        return 'El DNI debe contener entre 7 y 8 dígitos numéricos.';
      return 'Solo se permiten letras y espacios.';
    }
    return 'Campo inválido.';
  }
}
