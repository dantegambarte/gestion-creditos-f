import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../../core/models/app-error';
import { TempPasswordDialogComponent } from '../../../../../shared/components/temp-password-dialog/temp-password-dialog.component';
import { CustomerDetail } from '../../../models/customer.model';
import { CustomersService } from '../../customers.service';

@Component({
  selector: 'app-client-portal-panel',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [ButtonModule, ConfirmDialogModule, ToastModule, TempPasswordDialogComponent],
  templateUrl: './client-portal-panel.component.html',
})
export class ClientPortalPanelComponent {
  @Input() customer!: CustomerDetail;
  /** Emite cuando una acción del portal modifica el estado del cliente. */
  @Output() customerChanged = new EventEmitter<void>();

  private readonly customersService = inject(CustomersService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  showTempPasswordDialog = false;
  tempPassword = '';

  /**
   * Cierra el diálogo de contraseña temporal y notifica al padre para refrescar.
   */
  onTempPasswordClosed(): void {
    this.showTempPasswordDialog = false;
    this.tempPassword = '';
    this.customerChanged.emit();
  }

  /**
   * Confirma la habilitación del portal del cliente y muestra la contraseña temporal generada.
   */
  confirmEnablePortal(): void {
    this.confirmationService.confirm({
      header: 'Habilitar portal',
      message: `¿Habilitar acceso al portal para <strong>${this.customer.fullName}</strong>? Se generará una contraseña temporal.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Habilitar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass: 'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.enablePortal(this.customer.id).subscribe({
          next: ({ tempPassword }) => {
            this.tempPassword = tempPassword;
            this.showTempPasswordDialog = true;
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la deshabilitación del acceso al portal del cliente.
   */
  confirmDisablePortal(): void {
    this.confirmationService.confirm({
      header: 'Deshabilitar portal',
      message: `¿Deshabilitar el acceso al portal de <strong>${this.customer.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Deshabilitar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger h-11 px-5 rounded-xl',
      rejectButtonStyleClass: 'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.disablePortal(this.customer.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Portal deshabilitado', detail: '' });
            this.customerChanged.emit();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma el reseteo de la contraseña del portal y muestra la nueva contraseña temporal.
   */
  confirmResetPortalPassword(): void {
    this.confirmationService.confirm({
      header: 'Resetear contraseña del portal',
      message: `¿Resetear la contraseña del portal de <strong>${this.customer.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Resetear',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass: 'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.resetPortalPassword(this.customer.id).subscribe({
          next: ({ tempPassword }) => {
            this.tempPassword = tempPassword;
            this.showTempPasswordDialog = true;
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma el desbloqueo del acceso al portal del cliente.
   */
  confirmUnlockPortal(): void {
    this.confirmationService.confirm({
      header: 'Desbloquear portal',
      message: `¿Desbloquear el portal de <strong>${this.customer.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desbloquear',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass: 'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.unlockPortal(this.customer.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Portal desbloqueado', detail: '' });
            this.customerChanged.emit();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Maneja errores de acciones mostrando toast con severidad según el status HTTP.
   * @param err Error de la aplicación.
   */
  private handleActionError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
