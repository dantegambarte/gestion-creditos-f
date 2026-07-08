import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../core/models/app-error';
import { HeaderService } from '../../../../core/services/header.service';
import { TempPasswordDialogComponent } from '../../../../shared/components/temp-password-dialog/temp-password-dialog.component';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { UserDetail } from '../user.model';
import { UsersService } from '../users.service';
import { UserEditFormComponent } from './user-edit-form/user-edit-form.component';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

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
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    SkeletonModule,
    LoadingStateComponent,
    ErrorStateComponent,
    TempPasswordDialogComponent,
    UserEditFormComponent,
    BackButtonComponent,
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

  user: UserDetail | null = null;
  loading = false;
  error: AppError | null = null;

  editMode = false;

  showTempPasswordDialog = false;
  tempPassword = '';

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
   * Obtiene el ID del usuario desde la ruta.
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
   * Navega a la lista de usuarios.
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
   * Recarga los datos del usuario tras acciones que modifican su estado.
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

  enterEditMode(): void {
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editMode = false;
  }

  /**
   * Handler del evento saved del formulario de edición.
   * @param updated Usuario actualizado devuelto por el formulario hijo
   */
  onSaved(updated: UserDetail): void {
    const roleChanged = this.user?.role !== updated.role;
    this.user = updated;
    this.editMode = false;
    const detail = roleChanged
      ? 'Usuario actualizado. Su sesión activa fue invalidada.'
      : 'Usuario actualizado correctamente.';
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
    this.header.set([
      { label: 'Usuarios', route: '/admin/users' },
      { label: updated.fullName },
    ]);
  }

  /**
   * Confirma la desactivación del usuario via diálogo.
   */
  confirmDeactivate(): void {
    this.confirmationService.confirm({
      header: 'Desactivar usuario',
      message: `¿Desactivar a <strong>${this.user?.fullName}</strong>? No podrá desactivarlo si es el único Admin activo o tiene clientes asignados.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
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
   * Confirma la activación del usuario via diálogo.
   */
  confirmActivate(): void {
    this.confirmationService.confirm({
      header: 'Activar usuario',
      message: `¿Activar a <strong>${this.user?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
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
   * Confirma el reseteo de contraseña via diálogo y muestra la contraseña temporal generada.
   */
  confirmResetPassword(): void {
    this.confirmationService.confirm({
      header: 'Resetear contraseña',
      message: `¿Resetear la contraseña de <strong>${this.user?.fullName}</strong>? Se generará una contraseña temporal que deberás comunicar al usuario.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Resetear',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
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
   * Confirma el desbloqueo del usuario via diálogo.
   */
  confirmUnlock(): void {
    this.confirmationService.confirm({
      header: 'Desbloquear usuario',
      message: `¿Desbloquear a <strong>${this.user?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desbloquear',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
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
   * Maneja errores de acciones mostrando un toast con severidad según el status HTTP.
   * @param err Error de la aplicación
   */
  private handleActionError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
