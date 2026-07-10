import { DatePipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { FormatService } from '../../../../../core/services/format.service';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import {
  FREQUENCY_OPTIONS,
  PaymentFrequency,
} from '../../../../../shared/models/payment-frequency';
import {
  CreditDetail,
  RefinanceResult,
  SimulateResult,
} from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

@Component({
  selector: 'app-refinance-dialog',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
    CurrencyArsPipe,
  ],
  templateUrl: './refinance-dialog.component.html',
})
export class RefinanceDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Crédito activo: necesario para calcular el saldo pendiente. */
  @Input() credit: CreditDetail | null = null;
  /** Emite cuando la refinanciación fue confirmada con éxito. El padre recarga. */
  @Output() refinanced = new EventEmitter<void>();

  readonly FREQUENCY_OPTIONS = FREQUENCY_OPTIONS;

  refinanceStep: 1 | 2 = 1;
  refinanceInstallmentsCount: number | null = null;
  refinanceFrequency: PaymentFrequency = 'MONTHLY';
  refinanceReason = '';
  refinanceExtraCharges: number | null = null;
  refinanceNotes = '';
  refinanceSimulation: SimulateResult | null = null;
  refinanceSimulating = false;
  processingRefinance = false;

  private readonly creditsService = inject(CreditsService);
  private readonly msg = inject(MessageService);
  private readonly fmt = inject(FormatService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.refinanceStep = 1;
      this.refinanceInstallmentsCount = null;
      this.refinanceFrequency = 'MONTHLY';
      this.refinanceReason = '';
      this.refinanceExtraCharges = null;
      this.refinanceNotes = '';
      this.refinanceSimulation = null;
      this.processingRefinance = false;
    }
  }

  /**
   * Cierra el diálogo emitiendo el cambio de visibilidad al padre.
   */
  close(): void {
    this.visibleChange.emit(false);
  }

  /** Saldo pendiente del crédito: suma de cuotas no pagadas. */
  get refinancePendingBalance(): number {
    if (!this.credit) return 0;
    return (
      Math.round(
        this.credit.installments
          .filter((i) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status))
          .reduce((sum, i) => sum + (i.amountDue - i.amountPaid), 0) * 100,
      ) / 100
    );
  }

  /** Total trasladado: saldo + cargos adicionales opcionales. */
  get refinanceTotalTransferred(): number {
    return (
      Math.round(
        (this.refinancePendingBalance + (this.refinanceExtraCharges ?? 0)) *
          100,
      ) / 100
    );
  }

  get refinanceStep1Valid(): boolean {
    return (
      (this.refinanceInstallmentsCount ?? 0) >= 1 &&
      (this.refinanceInstallmentsCount ?? 0) <= 120 &&
      this.refinanceReason.trim().length >= 5
    );
  }

  /**
   * Paso 1 → 2: simula el nuevo crédito con el saldo pendiente.
   */
  goToStep2(): void {
    if (!this.refinanceStep1Valid || !this.credit) return;
    this.refinanceSimulating = true;
    this.creditsService
      .simulate({
        type: 'LOAN',
        totalAmount: this.refinanceTotalTransferred,
        installmentsCount: this.refinanceInstallmentsCount!,
        paymentFrequency: this.refinanceFrequency,
      })
      .subscribe({
        next: (result) => {
          this.refinanceSimulation = result;
          this.refinanceSimulating = false;
          this.refinanceStep = 2;
        },
        error: (err: AppError) => {
          this.refinanceSimulating = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Sin tasa' : 'Error',
            detail:
              err.message ?? 'No se pudo simular con los parámetros indicados.',
          });
        },
      });
  }

  /**
   * Confirma y ejecuta la refinanciación. El nuevo crédito queda en PENDING_APPROVAL.
   */
  confirm(): void {
    if (this.processingRefinance || !this.credit || !this.refinanceStep1Valid) return;
    this.processingRefinance = true;
    this.creditsService
      .refinance(this.credit.id, {
        installmentsCount: this.refinanceInstallmentsCount!,
        paymentFrequency: this.refinanceFrequency,
        reason: this.refinanceReason.trim(),
        extraCharges: this.refinanceExtraCharges ?? undefined,
        notes: this.refinanceNotes || undefined,
      })
      .subscribe({
        next: (result: RefinanceResult) => {
          this.processingRefinance = false;
          this.close();
          this.msg.add({
            severity: 'success',
            summary: 'Refinanciación creada',
            detail: `Nuevo crédito generado (${this.fmt.currency(result.totalTransferred, 2)}) pendiente de aprobación.`,
            life: 7000,
          });
          this.refinanced.emit();
        },
        error: (err: AppError) => {
          this.processingRefinance = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo crear la refinanciación.',
          });
        },
      });
  }
}
