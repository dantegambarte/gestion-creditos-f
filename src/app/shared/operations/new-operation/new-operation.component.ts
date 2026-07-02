import {
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { OperationFormService } from './operation-form.service';
import { OperationCatalogService } from './operation-catalog.service';
import { StepClientComponent } from './steps/step-client/step-client.component';
import { StepConditionsComponent } from './steps/step-conditions/step-conditions.component';
import { StepConfirmComponent } from './steps/step-confirm/step-confirm.component';
import { StepProductsComponent } from './steps/step-products/step-products.component';
import { StepTypeComponent } from './steps/step-type/step-type.component';
import { CustomerCreatePayload } from '../../../features/seller/models/customer.model';
import { FfBackTopFabComponent } from '../../components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-new-operation',
  standalone: true,
  imports: [
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    StepTypeComponent,
    StepClientComponent,
    StepProductsComponent,
    StepConditionsComponent,
    StepConfirmComponent,
    FfBackTopFabComponent,
  ],
  providers: [
    OperationFormService,
    OperationCatalogService,
    MessageService,
    ConfirmationService,
  ],
  templateUrl: './new-operation.component.html',
  styleUrl: './new-operation.component.scss',
})
export class NewOperationComponent implements OnInit {
  @Output() onComplete = new EventEmitter<void>();
  @ViewChild('wizardMain') private wizardMain?: ElementRef<HTMLElement>;
  @ViewChild('stepper') private stepper?: ElementRef<HTMLElement>;

  protected readonly state = inject(OperationFormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  activeIndex = 0;
  readonly steps: MenuItem[] = [
    { label: 'Tipo de Operación' },
    { label: 'Cliente' },
    { label: 'Tipo y Producto' },
    { label: 'Condiciones' },
    { label: 'Confirmación' },
  ];

  /**
   * Inicializa el wizard y preselecciona cliente si llega por query param.
   */
  ngOnInit(): void {
    const clientDni =
      this.route.snapshot.queryParamMap.get('clientDni') ?? undefined;
    this.state.initialize(clientDni).subscribe({
      next: (preselected) => {
        if (preselected) this.setActiveStep(1);
      },
      // CR-08: sin error handler, un fallo en loadClients dejaba clients=[] sin feedback
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error al cargar clientes',
          detail: 'No se pudo cargar la lista de clientes. Recargá la página.',
          life: 6000,
        });
      },
    });
  }

  /**
   * Avanza al siguiente paso visible del wizard.
   */
  nextStep(): void {
    if (this.activeIndex < 4) this.setActiveStep(this.activeIndex + 1);
  }

  /**
   * Retrocede al paso anterior visible del wizard.
   */
  prevStep(): void {
    if (this.activeIndex > 0) this.setActiveStep(this.activeIndex - 1);
  }

  /**
   * Hace que la flecha superior acompañe el wizard: vuelve un paso si puede,
   * y solo sale de la pantalla cuando todavía está en el primer paso.
   */
  handleBackAction(): void {
    if (this.activeIndex > 0) {
      this.prevStep();
      return;
    }
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  /**
   * Pide confirmación antes de abandonar el wizard para no perder la operación en curso.
   */
  confirmCancelOperation(): void {
    this.confirmationService.confirm({
      key: 'cancel-new-operation',
      header: 'Cancelar operación',
      message:
        '¿Estás seguro de cancelar la operación? Se perderán los datos cargados.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Continuar editando',
      rejectLabel: 'Sí, cancelar',
      acceptButtonStyleClass: 'h-11 px-4 rounded-xl',
      rejectButtonStyleClass:
        'p-button-danger p-button-outlined h-11 px-4 rounded-xl',
      reject: () => {
        this.router.navigate(['../'], { relativeTo: this.route });
      },
    });
  }

  /**
   * Define el tipo de operación en el formulario y avanza automáticamente.
   * @param {'SALE' | 'LOAN'} type - Tipo elegido en el paso inicial.
   */
  onTypeSelected(type: 'SALE' | 'LOAN'): void {
    this.state.operationForm.controls.operationType.setValue(type);
    this.nextStep();
  }

  /**
   * Muestra el alta rápida inline cuando el cliente no existe todavía.
   */
  openNewClient(): void {
    this.state.openQuickClientForm();
  }

  /**
   * Cierra el panel de alta rápida sin tocar el resto del flujo.
   */
  cancelQuickClient(): void {
    this.state.closeQuickClientForm();
  }

  /**
   * Crea un cliente mínimo desde el wizard y continúa automáticamente al siguiente paso.
   * @param {CustomerCreatePayload} payload - Datos mínimos del nuevo cliente.
   */
  createQuickClient(payload: CustomerCreatePayload): void {
    this.state.createQuickClient(payload).subscribe({
      next: () => {
        this.nextStep();
      },
      error: (err: unknown) => {
        const detail =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'No se pudo registrar el cliente.';

        this.messageService.add({
          severity: 'error',
          summary: 'Error al registrar cliente',
          detail,
          life: 5000,
        });
      },
    });
  }

  /**
   * Traduce el índice visual al índice de validación del servicio.
   */
  canGoNext(): boolean {
    if (this.activeIndex === 0)
      return this.state.operationForm.controls.operationType.valid;
    if (this.activeIndex === 4) return false;
    return this.state.canNext(this.activeIndex - 1);
  }

  /**
   * Envía la operación para aprobación y maneja navegación posterior al resultado.
   */
  submitOperation(): void {
    this.state.submit().subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Operación enviada',
          detail: 'La operación fue enviada para aprobación correctamente.',
          life: 3000,
        });
        this.onComplete.emit();
        const base = this.router.url.split('/operations')[0];
        const destination = base === '/admin' ? 'approvals' : 'operations';
        setTimeout(() => {
          this.router.navigate([base, destination]);
          this.state.submitting.set(false);
        }, 1500);
      },
      error: (err: unknown) => {
        this.state.submitting.set(false);
        const apiMessage =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : '';

        // CR-09: unidad stale — la unidad fue reservada entre carga y envío
        const isUnitNotFound =
          apiMessage.toLowerCase().includes('no encontrada') ||
          apiMessage.toLowerCase().includes('not found');

        const detail = isUnitNotFound
          ? 'Una unidad seleccionada ya no está disponible. Recargá el catálogo y elegí otra.'
          : apiMessage || 'No se pudo registrar la operación.';

        this.messageService.add({
          severity: 'error',
          summary: isUnitNotFound ? 'Unidad no disponible' : 'Error',
          detail,
          life: 6000,
        });

        if (isUnitNotFound) {
          this.state.reloadCatalogAfterUnitError();
        }
      },
    });
  }

  /**
   * Centraliza el cambio de paso para resetear scroll y centrar el stepper activo.
   * @param {number} index - Índice visual del paso destino.
   */
  private setActiveStep(index: number): void {
    this.activeIndex = index;
    setTimeout(() => {
      this.wizardMain?.nativeElement.scrollTo({ top: 0, behavior: 'auto' });
      this.stepper?.nativeElement
        .querySelector<HTMLElement>(`[data-step-index="${index}"]`)
        ?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
    }, 0);
  }
}
