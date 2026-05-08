import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { UsersService } from '../users.service';
import { UserDetail, UserUpdatePayload } from '../user.model';
import { UserRole } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { TempPasswordDialogComponent } from '../../../../shared/components/temp-password-dialog/temp-password-dialog.component';
import { AppError } from '../../../../core/models/app-error';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
  COLLECTOR: 'Cobrador',
  SELLER_COLLECTOR: 'Vendedor/Cobrador',
};

const ROLE_SEVERITY: Record<string, string> = {
  ADMIN: 'danger',
  SELLER: 'info',
  COLLECTOR: 'success',
  SELLER_COLLECTOR: 'warning',
};

@Component({
  selector: 'app-user-detail',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    InputTextModule,
    DropdownModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    TempPasswordDialogComponent,
  ],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  user: UserDetail | null = null;
  loading = false;
  error: AppError | null = null;

  editMode = false;
  saving = false;
  editForm!: FormGroup;
  private originalRole: UserRole | null = null;

  showTempPasswordDialog = false;
  tempPassword = '';

  readonly roleOptions = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Vendedor', value: 'SELLER' },
    { label: 'Cobrador', value: 'COLLECTOR' },
    { label: 'Vendedor/Cobrador', value: 'SELLER_COLLECTOR' },
  ];

  roleLabel(role: string): string {
    return ROLE_LABEL[role] ?? role;
  }
  roleSeverity(
    role: string,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    return (ROLE_SEVERITY[role] ?? 'secondary') as
      | 'success'
      | 'info'
      | 'warning'
      | 'danger'
      | 'secondary';
  }

  /**
   * Indica si el rol fue modificado respecto al valor original. Esto se usa para mostrar un mensaje específico al guardar, ya que si el rol cambia a un usuario con sesión activa, esta se invalida y el usuario deberá loguearse nuevamente para continuar usando la aplicación.
   */
  get roleChanged(): boolean {
    return (
      !!this.editForm && this.editForm.get('role')?.value !== this.originalRole
    );
  }

  /**
   * Obtiene el ID del usuario desde la ruta. Se asume que la ruta siempre tendrá un ID válido, ya que esta página solo es accesible desde la lista de usuarios, donde cada usuario tiene un enlace a su detalle. Si el ID no es válido, el servicio de usuarios retornará un error que se muestra en pantalla.
   */
  private get userId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Usuarios', route: '/admin/users' },
      { label: 'Detalle' },
    ]);
    this.load();
  }

  /**
   * Navega a la página anterior.
   */
  goBack(): void {
    this.router.navigate(['/', AppRoutes.ADMIN, AppRoutes.USERS]);
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.usersService.getById(this.userId).subscribe({
      next: (data) => {
        this.user = data;
        this.header.set([
          { label: 'Usuarios', route: '/admin/users' },
          { label: data.fullName },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  /**
   * Recarga los datos del usuario. Se usa después de acciones que modifican el estado del usuario (activar/desactivar, resetear contraseña, desbloquear) para mostrar la información actualizada.
   */
  private refresh(): void {
    this.usersService.getById(this.userId).subscribe({
      next: (data) => {
        this.user = data;
        this.header.set([
          { label: 'Usuarios', route: '/admin/users' },
          { label: data.fullName },
        ]);
      },
      error: () => {},
    });
  }

  /**
   * Entra en modo edición, mostrando el formulario con los datos del usuario. Se guarda el rol original para poder comparar si este cambió al momento de guardar y mostrar un mensaje específico en ese caso, ya que si el rol cambia a un usuario con sesión activa, esta se invalida y el usuario deberá loguearse nuevamente para continuar usando la aplicación.
   * @returns
   */
  enterEditMode(): void {
    if (!this.user) return;
    this.originalRole = this.user.role;
    this.editForm = this.fb.group({
      fullName: [
        this.user.fullName,
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
        ],
      ],
      dni: [this.user.dni, [Validators.required]],
      email: [this.user.email ?? '', [Validators.email]],
      address: [this.user.address ?? '', [Validators.maxLength(255)]],
      role: [this.user.role, [Validators.required]],
    });
    this.editMode = true;
  }

  /**
   * Cancela el modo edición, ocultando el formulario y descartando los cambios realizados. Si se estaba guardando, también cancela ese estado para permitir volver a intentar guardar después de corregir posibles errores.
   */
  cancelEdit(): void {
    this.editMode = false;
    this.saving = false;
  }

  /**
   * Guarda los cambios realizados en el formulario. Si el formulario es inválido, marca todos los campos como tocados para mostrar los errores de validación. Si el formulario es válido, envía la solicitud de actualización al servicio de usuarios. Si la actualización es exitosa, muestra un mensaje de éxito y actualiza la información del usuario en pantalla. Si ocurre un error, muestra un mensaje de error específico si el error es de conflicto (409) relacionado con email o DNI, o un mensaje genérico para otros tipos de error.
   * @returns
   */
  onEditSubmit(): void {
    if (!this.user || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const raw = this.editForm.getRawValue();
    const roleChangedNow = raw.role !== this.originalRole;
    const payload: UserUpdatePayload = {
      fullName: raw.fullName,
      dni: raw.dni,
      email: raw.email || undefined,
      address: raw.address || undefined,
      role: raw.role,
    };

    this.usersService.update(this.userId, payload).subscribe({
      next: (updated) => {
        this.user = updated;
        this.saving = false;
        this.editMode = false;
        const detail = roleChangedNow
          ? 'Usuario actualizado. Su sesión activa fue invalidada.'
          : 'Usuario actualizado correctamente.';
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail,
        });
        this.header.set([
          { label: 'Usuarios', route: '/admin/users' },
          { label: updated.fullName },
        ]);
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
            this.messageService.add({
              severity: 'warn',
              summary: 'Conflicto',
              detail: msg,
            });
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
   * Indica si un campo del formulario de edición es inválido y ha sido modificado o tocado, lo que se usa para mostrar los mensajes de error correspondientes. Si el campo no existe en el formulario, retorna false.
   * @param field
   * @returns
   */
  isEditInvalid(field: string): boolean {
    const c = this.editForm?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /**
   * Obtiene el mensaje de error correspondiente para un campo del formulario de edición. Si el campo no existe o no tiene errores, retorna una cadena vacía. Si el campo tiene un error de validación específico (requerido, longitud mínima/máxima, formato de email), retorna un mensaje específico para ese error. Si el campo tiene un error de servidor (por ejemplo, conflicto de email o DNI), retorna el mensaje proporcionado por el servidor. Para otros tipos de error, retorna un mensaje genérico de campo inválido.
   * @param field
   * @returns
   */
  getEditError(field: string): string {
    const camp = this.editForm?.get(field);
    if (!camp?.errors) return '';
    if (camp.errors['serverError']) return camp.errors['serverError'];
    if (camp.errors['required']) return 'Este campo es requerido.';
    if (camp.errors['minlength'])
      return `Mínimo ${camp.errors['minlength'].requiredLength} caracteres.`;
    if (camp.errors['maxlength'])
      return `Máximo ${camp.errors['maxlength'].requiredLength} caracteres.`;
    if (camp.errors['email']) return 'Formato de email inválido.';
    return 'Campo inválido.';
  }

  /**
   * Confirma la desactivación del usuario. Muestra un diálogo de confirmación con el nombre del usuario a desactivar. Si se confirma, envía la solicitud de desactivación al servicio de usuarios. Si la desactivación es exitosa, muestra un mensaje de éxito y actualiza la información del usuario en pantalla. Si ocurre un error, muestra un mensaje de error específico si el error es de conflicto (409) relacionado con tener clientes asignados o ser el único Admin activo, o un mensaje genérico para otros tipos de error.
   */
  confirmDeactivate(): void {
    this.confirmationService.confirm({
      header: 'Desactivar usuario',
      message: `¿Desactivar a <strong>${this.user?.fullName}</strong>? No podrá desactivarlo si es el único Admin activo o tiene clientes asignados.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.usersService.deactivate(this.userId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Usuario desactivado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la activación del usuario. Muestra un diálogo de confirmación con el nombre del usuario a activar. Si se confirma, envía la solicitud de activación al servicio de usuarios. Si la activación es exitosa, muestra un mensaje de éxito y actualiza la información del usuario en pantalla. Si ocurre un error, muestra un mensaje de error específico si el error es de conflicto (409) relacionado con tener clientes asignados o ser el único Admin activo, o un mensaje genérico para otros tipos de error.
   */
  confirmActivate(): void {
    this.confirmationService.confirm({
      header: 'Activar usuario',
      message: `¿Activar a <strong>${this.user?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.usersService.activate(this.userId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Usuario activado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma el reseteo de contraseña del usuario. Muestra un diálogo de confirmación con el nombre del usuario a resetear la contraseña. Si se confirma, envía la solicitud de reseteo de contraseña al servicio de usuarios. Si el reseteo es exitoso, muestra un diálogo con la contraseña temporal generada que se debe comunicar al usuario, y actualiza la información del usuario en pantalla. Si ocurre un error, muestra un mensaje de error específico si el error es de conflicto (409) relacionado con tener clientes asignados o ser el único Admin activo, o un mensaje genérico para otros tipos de error.
   */
  confirmResetPassword(): void {
    this.confirmationService.confirm({
      header: 'Resetear contraseña',
      message: `¿Resetear la contraseña de <strong>${this.user?.fullName}</strong>? Se generará una contraseña temporal que deberás comunicar al usuario.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Resetear',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.usersService.resetPassword(this.userId).subscribe({
          next: ({ tempPassword }) => {
            this.tempPassword = tempPassword;
            this.showTempPasswordDialog = true;
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma el desbloqueo del usuario. Muestra un diálogo de confirmación con el nombre del usuario a desbloquear. Si se confirma, envía la solicitud de desbloqueo al servicio de usuarios. Si el desbloqueo es exitoso, muestra un mensaje de éxito y actualiza la información del usuario en pantalla. Si ocurre un error, muestra un mensaje de error específico si el error es de conflicto (409) relacionado con tener clientes asignados o ser el único Admin activo, o un mensaje genérico para otros tipos de error.
   */
  confirmUnlock(): void {
    this.confirmationService.confirm({
      header: 'Desbloquear usuario',
      message: `¿Desbloquear a <strong>${this.user?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desbloquear',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.usersService.unlock(this.userId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Usuario desbloqueado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Maneja el cierre del diálogo de contraseña temporal.
   */
  onTempPasswordClosed(): void {
    this.showTempPasswordDialog = false;
    this.tempPassword = '';
    this.refresh();
  }

  /**
   * Maneja los errores de las acciones.
   */
  private handleActionError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
