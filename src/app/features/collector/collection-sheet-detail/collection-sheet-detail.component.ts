import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { InstallmentStatus } from '../../seller/models/installment.model';
import { CollectionsService } from '../collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionSheetDetail,
  CollectionSheetItem,
} from '../models/collection.model';
import { PaymentCreatePayload } from '../models/payment.model';
import { PaymentsService } from '../payments.service';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';

interface SheetItemWithState extends CollectionSheetItem {
  hasPendingPayment: boolean;
}

@Component({
  selector: 'app-collection-sheet-detail',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    TagModule,
    BadgeModule,
    ToastModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputTextareaModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './collection-sheet-detail.component.html',
})
export class CollectionSheetDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly collectionsService = inject(CollectionsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);

  sheet: CollectionSheetDetail | null = null;
  items: SheetItemWithState[] = [];
  loading = true;
  error: AppError | null = null;

  showPaymentDialog = false;
  dialogItem: SheetItemWithState | null = null;
  paymentAmount: number | null = null;
  paymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  transferReference = '';
  paymentNotes = '';
  processingPayment = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  /**
   * Obtiene el ID de la planilla de cobranza desde la URL, extrayéndolo de los parámetros de la ruta utilizando ActivatedRoute. Se asume que la ruta está configurada para incluir un parámetro llamado 'sheetId'. El operador non-null assertion (`!`) se utiliza para indicar que se espera que este valor siempre esté presente en la URL.
   */
  private get sheetId(): string {
    return this.route.snapshot.paramMap.get('sheetId')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Mi Ruta', route: AppRoutes.ROUTE },
      { label: 'Planilla' },
    ]);
    this.load();
  }

  /**
   * Navega hacia atrás en el historial del navegador utilizando el servicio Location de Angular. Esto permite al usuario regresar a la página anterior, que presumiblemente es la lista de planillas de cobranza o el dashboard del cobrador, dependiendo de cómo haya llegado a esta página de detalle.
   */
  goBack(): void {
    this.router.navigate([AppRoutes.COLLECTOR, 'route']);
  }

  /**
   * Obtiene la etiqueta correspondiente a un filtro de planilla de cobranza.
   * @param f
   * @returns
   */
  filterLabel(f: string): string {
    return (
      COLLECTION_FILTER_LABELS[f as keyof typeof COLLECTION_FILTER_LABELS] ?? f
    );
  }

  /**
   * Obtiene el severidad correspondiente a un estado de cuota.
   * @param status
   * @returns
   */
  installmentSeverity(
    status: InstallmentStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      InstallmentStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING: 'info',
      OVERDUE: 'danger',
      PAID: 'success',
      PARTIAL: 'warning',
    };
    return map[status] ?? 'secondary';
  }

  /**
   * Obtiene la etiqueta correspondiente a un estado de cuota.
   * @param status
   * @returns
   */
  installmentLabel(status: InstallmentStatus): string {
    const map: Record<InstallmentStatus, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'Vencida',
      PAID: 'Pagada',
      PARTIAL: 'Parcial',
    };
    return map[status] ?? status;
  }

  /**
   * Obtiene el saldo disponible para un ítem de planilla de cobranza.
   * @param item
   * @returns
   */
  availableBalance(item: CollectionSheetItem): number {
    return Math.max(0, item.amountDue - item.amountPaid);
  }

  /**
   * Determina si se puede registrar un pago para un ítem de planilla de cobranza.
   * @param item
   * @returns
   */
  canRegisterPayment(item: SheetItemWithState): boolean {
    return item.installmentStatus !== 'PAID' && !item.hasPendingPayment;
  }

  /**
   * Abre el diálogo para registrar un pago.
   * @param item
   */
  openPaymentDialog(item: SheetItemWithState): void {
    this.dialogItem = item;
    this.paymentAmount = this.availableBalance(item);
    this.paymentMethod = 'CASH';
    this.transferReference = '';
    this.paymentNotes = '';
    this.showPaymentDialog = true;
  }

  /**
   * Confirma el registro de un pago. Valida que se haya ingresado un monto válido y que no supere el saldo disponible. Luego, crea un payload con los datos del pago y llama al servicio de pagos para registrar el cobro. Maneja la respuesta del servicio mostrando mensajes de éxito o error según corresponda, y actualiza el estado del ítem en la planilla si el registro fue exitoso.
   * @returns
   */
  confirmPayment(): void {
    if (!this.dialogItem || !this.paymentAmount || this.paymentAmount <= 0)
      return;

    const balance = this.availableBalance(this.dialogItem);
    if (this.paymentAmount > balance) {
      this.msg.add({
        severity: 'warn',
        summary: 'Monto inválido',
        detail: `El monto no puede superar el saldo disponible ($${balance.toFixed(2)})`,
      });
      return;
    }

    this.processingPayment = true;
    const payload: PaymentCreatePayload = {
      installmentId: this.dialogItem.installmentId,
      amountReceived: this.paymentAmount,
      paymentMethod: this.paymentMethod,
    };
    if (this.paymentMethod === 'TRANSFER' && this.transferReference) {
      payload.transferReference = this.transferReference;
    }
    if (this.paymentNotes) {
      payload.notes = this.paymentNotes;
    }

    const itemId = this.dialogItem.installmentId;

    this.paymentsService.create(payload).subscribe({
      next: (result) => {
        this.processingPayment = false;
        this.showPaymentDialog = false;
        this.markItemAsPending(itemId);

        if (result.warning) {
          this.msg.add({
            severity: 'warn',
            summary: 'Cobro registrado con advertencia',
            detail: result.warning,
            life: 6000,
          });
        } else {
          this.msg.add({
            severity: 'success',
            summary: 'Cobro registrado',
            detail:
              'Pre-carga registrada correctamente. Pendiente de aprobación.',
            life: 4000,
          });
        }
      },
      error: (err: AppError) => {
        this.processingPayment = false;
        const severity =
          err.status === 409 || err.status === 422 ? 'warn' : 'error';
        this.msg.add({
          severity,
          summary:
            err.status === 422
              ? 'Monto inválido'
              : err.status === 409
                ? 'Advertencia'
                : 'Error',
          detail: err.message ?? 'No se pudo registrar el cobro.',
        });
      },
    });
  }

  /**
   * Marca un ítem como pendiente de pago.
   * @param installmentId
   */
  private markItemAsPending(installmentId: string): void {
    this.items = this.items.map((i) =>
      i.installmentId === installmentId ? { ...i, hasPendingPayment: true } : i,
    );
  }

  /**
   * Carga los detalles de la planilla de cobranza desde el servicio de colecciones utilizando el ID obtenido de la URL. Maneja el estado de carga y error, y actualiza el encabezado de la página con la fecha de la planilla una vez que los datos se han cargado correctamente. Si ocurre un error durante la carga, se almacena el error para mostrar un mensaje adecuado al usuario.
   */
  private load(): void {
    this.loading = true;
    this.collectionsService.getById(this.sheetId).subscribe({
      next: (data) => {
        this.sheet = data;
        this.items = [...data.items]
          .sort((a, b) => a.orderNumber - b.orderNumber)
          .map((item) => ({ ...item, hasPendingPayment: false }));
        this.header.set([
          { label: 'Mi Ruta', route: '/collector/route' },
          {
            label: `Planilla ${new Date(data.sheetDate).toLocaleDateString('es-AR')}`,
          },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
