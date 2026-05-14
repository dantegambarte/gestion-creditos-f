import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { UsersService } from '../../../../features/admin/users/users.service';
import { TempPasswordDialogComponent } from '../../../../shared/components/temp-password-dialog/temp-password-dialog.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { Credit, CreditStatus } from '../../models/credit.model';
import {
  CustomerDetail,
  CustomerUpdatePayload,
} from '../../models/customer.model';
import { CreditsService } from '../../operations/credits.service';
import { CustomersService } from '../customers.service';

@Component({
  selector: 'app-client-detail',
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
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly creditsService = inject(CreditsService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthServiceBase);
  private readonly location = inject(Location);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  customer: CustomerDetail | null = null;
  credits: Credit[] = [];
  loading = false;
  loadingCredits = false;
  error: AppError | null = null;

  editMode = false;
  saving = false;
  editForm!: FormGroup;
  collectorOptions: { label: string; value: string }[] = [];
  collectorsLoading = false;

  showTempPasswordDialog = false;
  tempPassword = '';

  /**
   * Indica si el usuario actual tiene rol de ADMIN, lo que habilita ciertas acciones en la interfaz.
   * @return true si el usuario tiene rol ADMIN, false en caso contrario.
   */
  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  /**
   * Obtiene el ID del cliente desde la ruta activa. Este ID se utiliza para cargar los detalles del cliente y realizar acciones específicas sobre él.
   * @returns El ID del cliente como string.
   */
  private get customerId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Clientes', route: this.clientsBaseRoute },
      { label: 'Detalle' },
    ]);
    this.load();
  }

  /**
   * Calcula la ruta base de clientes según el módulo actual (admin/seller).
   * @returns Ruta absoluta al listado de clientes.
   */
  private get clientsBaseRoute(): string {
    const root = this.router.url.startsWith('/admin') ? '/admin' : '/seller';
    return `${root}/clients`;
  }

  /**
   * Navega de vuelta a la lista de clientes sin guardar los cambios. Utiliza el servicio Location para retroceder en el historial del navegador.
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Carga los detalles del cliente utilizando el ID obtenido de la ruta. Maneja los estados de carga y error, y actualiza el encabezado con el nombre del cliente una vez cargado. Si ocurre un error durante la carga, se almacena en la propiedad `error` para mostrar un mensaje adecuado en la interfaz.
   */
  private load(): void {
    this.loading = true;
    this.error = null;
    this.customersService.getById(this.customerId).subscribe({
      next: (data) => {
        this.customer = data;
        this.header.set([
          { label: 'Clientes', route: this.clientsBaseRoute },
          { label: data.fullName },
        ]);
        this.loadCredits(data.id);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  /**
   * Refresca los detalles del cliente después de realizar una acción que pueda haber modificado su información (como editar, activar/desactivar, habilitar/deshabilitar portal, etc.). Vuelve a cargar los datos del cliente desde el backend y actualiza el encabezado con el nombre actualizado. Si ocurre un error durante la carga, se ignora para no sobrescribir posibles errores específicos de la acción realizada.
   */
  private refresh(): void {
    this.customersService.getById(this.customerId).subscribe({
      next: (data) => {
        this.customer = data;
        this.header.set([
          { label: 'Clientes', route: this.clientsBaseRoute },
          { label: data.fullName },
        ]);
        this.loadCredits(data.id);
      },
      error: () => {},
    });
  }

  /**
   * Activa el modo de edición para modificar los detalles del cliente.
   * @returns
   */
  enterEditMode(): void {
    if (!this.customer) return;
    this.editForm = this.fb.group({
      fullName: [
        this.customer.fullName,
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
        ],
      ],
      address: [this.customer.address ?? '', [Validators.maxLength(255)]],
      phone: [this.customer.phone ?? ''],
      email: [this.customer.email ?? '', [Validators.email]],
      assignedCollectorId: [this.customer.collectorId ?? ''],
    });
    this.editMode = true;
    this.loadCollectors();
  }

  /**
   * Verifica si un campo del formulario de edición es inválido, lo que se utiliza para mostrar mensajes de error y estilos en la interfaz. Un campo se considera inválido si no cumple con las validaciones definidas y ha sido modificado o tocado por el usuario.
   */
  private loadCollectors(): void {
    this.collectorsLoading = true;
    this.usersService.listCollectors().subscribe({
      next: (collectors) => {
        this.collectorOptions = collectors.map((c) => ({
          label: c.fullName,
          value: c.id,
        }));
        this.collectorsLoading = false;
      },
      error: () => {
        this.collectorsLoading = false;
      },
    });
  }

  /**
   * Cancela el modo de edición sin guardar los cambios realizados en el formulario. Restablece el estado de `editMode` a false y `saving` a false para volver a la vista de detalles del cliente.
   */
  cancelEdit(): void {
    this.editMode = false;
    this.saving = false;
  }

  /**
   * Envía el formulario de edición y actualiza los detalles del cliente.
   * @returns
   */
  onEditSubmit(): void {
    if (!this.customer || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const raw = this.editForm.getRawValue();
    const payload: CustomerUpdatePayload = {
      fullName: raw.fullName,
      address: raw.address || undefined,
      phone: raw.phone || undefined,
      email: raw.email || undefined,
      assignedCollectorId: raw.assignedCollectorId || undefined,
    };

    this.customersService.update(this.customerId, payload).subscribe({
      next: (updated) => {
        this.customer = updated;
        this.saving = false;
        this.editMode = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Cliente actualizado correctamente.',
        });
        this.header.set([
          { label: 'Clientes', route: this.clientsBaseRoute },
          { label: updated.fullName },
        ]);
      },
      error: (err: AppError) => {
        this.saving = false;
        if (err.status === 404) {
          this.editForm
            .get('assignedCollectorId')!
            .setErrors({ serverError: err.message });
          this.editForm.get('assignedCollectorId')!.markAsDirty();
        } else if (err.status === 409) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Conflicto',
            detail: err.message,
          });
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
   * Carga el historial de créditos del cliente para mostrarlo en el panel derecho.
   * @param customerId ID interno del cliente.
   */
  private loadCredits(customerId: string): void {
    this.loadingCredits = true;
    this.creditsService.list({ customerId }).subscribe({
      next: (credits) => {
        this.credits = credits;
        this.loadingCredits = false;
      },
      error: () => {
        this.credits = [];
        this.loadingCredits = false;
      },
    });
  }

  /**
   * Devuelve una etiqueta legible para el estado del crédito.
   * @param status Estado técnico del crédito.
   * @returns Estado listo para UI.
   */
  creditStatusLabel(status: CreditStatus): string {
    const map: Record<CreditStatus, string> = {
      PENDING_APPROVAL: 'Pendiente',
      ACTIVE: 'Activo',
      SETTLED: 'Liquidado',
      REJECTED: 'Rechazado',
      EXPIRED: 'Vencido',
    };
    return map[status];
  }

  /**
   * Asigna severidad visual al estado de crédito.
   * @param status Estado técnico del crédito.
   * @returns Severidad de PrimeNG para p-tag.
   */
  creditStatusSeverity(
    status: CreditStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      CreditStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING_APPROVAL: 'warning',
      ACTIVE: 'success',
      SETTLED: 'secondary',
      REJECTED: 'danger',
      EXPIRED: 'danger',
    };
    return map[status];
  }

  /**
   * Traduce la frecuencia de pago al formato visible en la tabla.
   * @param frequency Frecuencia técnica del crédito.
   * @returns Etiqueta legible.
   */
  creditFrequencyLabel(frequency: string | null | undefined): string {
    if (!frequency) return '—';
    const map: Record<string, string> = {
      WEEKLY: 'Semanal',
      BIWEEKLY: 'Quincenal',
      MONTHLY: 'Mensual',
    };
    return map[frequency] ?? frequency;
  }

  /**
   * Navega al detalle de operación/crédito desde la tabla de historial.
   * @param creditId ID del crédito a visualizar.
   */
  openCreditDetail(creditId: string): void {
    this.router.navigate([
      this.clientsBaseRoute.replace('/clients', '/operations'),
      creditId,
    ]);
  }

  /**
   * Verifica si un campo del formulario de edición es inválido.
   * @param field
   * @returns
   */
  isEditInvalid(field: string): boolean {
    const c = this.editForm?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /**
   * Obtiene el mensaje de error para un campo del formulario de edición.
   * @param field
   * @returns
   */
  getEditError(field: string): string {
    const c = this.editForm?.get(field);
    if (!c?.errors) return '';
    if (c.errors['serverError']) return c.errors['serverError'];
    if (c.errors['required']) return 'Este campo es requerido.';
    if (c.errors['minlength'])
      return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength'])
      return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    if (c.errors['email']) return 'Formato de email inválido.';
    return 'Campo inválido.';
  }

  /**
   * Confirma la acción de desactivar el cliente mediante un diálogo de confirmación. Si el usuario acepta, se llama al servicio para desactivar el cliente y se maneja la respuesta mostrando mensajes de éxito o error según corresponda. La desactivación de un cliente implica que no puede tener créditos activos o pendientes de aprobación.
   */
  confirmDeactivate(): void {
    this.confirmationService.confirm({
      header: 'Desactivar cliente',
      message: `¿Desactivar a <strong>${this.customer?.fullName}</strong>? El cliente no puede tener créditos activos o pendientes de aprobación.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.deactivate(this.customerId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Cliente desactivado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la acción de activar el cliente mediante un diálogo de confirmación. Si el usuario acepta, se llama al servicio para activar el cliente y se maneja la respuesta mostrando mensajes de éxito o error según corresponda. La activación de un cliente implica que puede volver a tener créditos activos o pendientes de aprobación.
   */
  confirmActivate(): void {
    this.confirmationService.confirm({
      header: 'Activar cliente',
      message: `¿Activar a <strong>${this.customer?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.activate(this.customerId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Cliente activado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la acción de habilitar el portal para el cliente mediante un diálogo de confirmación. Si el usuario acepta, se llama al servicio para habilitar el portal, lo que genera una contraseña temporal. La contraseña temporal se muestra en un diálogo específico para este propósito. Si ocurre un error durante la habilitación, se maneja mostrando un mensaje adecuado.
   */
  confirmEnablePortal(): void {
    this.confirmationService.confirm({
      header: 'Habilitar portal',
      message: `¿Habilitar acceso al portal para <strong>${this.customer?.fullName}</strong>? Se generará una contraseña temporal.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Habilitar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.enablePortal(this.customerId).subscribe({
          next: ({ tempPassword }) => {
            this.tempPassword = tempPassword;
            this.showTempPasswordDialog = true;
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la acción de deshabilitar el portal para el cliente mediante un diálogo de confirmación. Si el usuario acepta, se llama al servicio para deshabilitar el portal, lo que revoca el acceso del cliente al mismo. Si ocurre un error durante la deshabilitación, se maneja mostrando un mensaje adecuado.
   */
  confirmDisablePortal(): void {
    this.confirmationService.confirm({
      header: 'Deshabilitar portal',
      message: `¿Deshabilitar el acceso al portal de <strong>${this.customer?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Deshabilitar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.disablePortal(this.customerId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Portal deshabilitado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la acción de resetear la contraseña del portal para el cliente mediante un diálogo de confirmación. Si el usuario acepta, se llama al servicio para resetear la contraseña, lo que genera una nueva contraseña temporal. La contraseña temporal se muestra en un diálogo específico para este propósito. Si ocurre un error durante el reseteo, se maneja mostrando un mensaje adecuado.
   */
  confirmResetPortalPassword(): void {
    this.confirmationService.confirm({
      header: 'Resetear contraseña del portal',
      message: `¿Resetear la contraseña del portal de <strong>${this.customer?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Resetear',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.resetPortalPassword(this.customerId).subscribe({
          next: ({ tempPassword }) => {
            this.tempPassword = tempPassword;
            this.showTempPasswordDialog = true;
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la acción de desbloquear el portal para el cliente mediante un diálogo de confirmación. Si el usuario acepta, se llama al servicio para desbloquear el portal, lo que restablece los intentos fallidos y desbloquea el acceso del cliente al portal. Si ocurre un error durante el desbloqueo, se maneja mostrando un mensaje adecuado.
   */
  confirmUnlockPortal(): void {
    this.confirmationService.confirm({
      header: 'Desbloquear portal',
      message: `¿Desbloquear el portal de <strong>${this.customer?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desbloquear',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.unlockPortal(this.customerId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Portal desbloqueado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Maneja el cierre del diálogo de contraseña temporal. Restablece el estado del diálogo y la contraseña temporal, y refresca los detalles del cliente para reflejar cualquier cambio realizado.
   * @returns
   */
  onTempPasswordClosed(): void {
    this.showTempPasswordDialog = false;
    this.tempPassword = '';
    this.refresh();
  }

  /**
   * Maneja los errores de las acciones del cliente.
   * @param err - El error ocurrido.
   */
  private handleActionError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
