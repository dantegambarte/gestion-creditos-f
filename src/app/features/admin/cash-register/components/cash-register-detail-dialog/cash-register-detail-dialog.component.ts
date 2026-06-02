import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Subject, takeUntil } from 'rxjs';
import { FormatService } from '../../../../../core/services/format.service';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { CashRegisterDetail } from '../../../models/cash-register.model';
import { CashRegisterService } from '../../cash-register.service';

@Component({
  selector: 'app-cash-register-detail-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, LoadingStateComponent],
  templateUrl: './cash-register-detail-dialog.component.html',
})
export class CashRegisterDetailDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  /** ID del registro a cargar. */
  @Input() registerId: string | null = null;
  /** Cierra el dialog via two-way binding. */
  @Output() visibleChange = new EventEmitter<boolean>();

  private readonly service = inject(CashRegisterService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  selectedRegister: CashRegisterDetail | null = null;
  loadingDetail = false;

  /**
   * Carga el detalle cuando el dialog se abre con un registerId válido.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.registerId) {
      this.loadDetail();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el breakdown completo del registro desde el servidor.
   */
  private loadDetail(): void {
    if (!this.registerId) return;
    this.selectedRegister = null;
    this.loadingDetail = true;
    this.service
      .getById(this.registerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.selectedRegister = detail;
          this.loadingDetail = false;
        },
        error: () => {
          this.loadingDetail = false;
          this.visibleChange.emit(false);
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar el detalle.',
            life: 4000,
          });
        },
      });
  }

  get detailPaymentsTotal(): number {
    return (
      this.selectedRegister?.breakdown.payments.reduce(
        (s, p) => s + p.amountReceived,
        0,
      ) ?? 0
    );
  }

  get detailDownPaymentsTotal(): number {
    return (
      this.selectedRegister?.breakdown.downPayments.reduce(
        (s, p) => s + p.amount,
        0,
      ) ?? 0
    );
  }

  get detailExpensesTotal(): number {
    return (
      this.selectedRegister?.breakdown.expenses.reduce(
        (s, e) => s + e.amount,
        0,
      ) ?? 0
    );
  }

  get detailLiquidationsTotal(): number {
    return (
      this.selectedRegister?.breakdown.liquidations.reduce(
        (s, l) => s + l.totalPaid,
        0,
      ) ?? 0
    );
  }

  /**
   * Devuelve la etiqueta legible del método de pago.
   * @param method CASH o TRANSFER
   */
  paymentMethodLabel(method: string): string {
    return method === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  /**
   * Formatea un valor como moneda.
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha ISO al formato dd/mm/yyyy.
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  /**
   * Formatea una fecha ISO con hora al formato dd/mm/yyyy HH:mm.
   */
  formatDateTime(iso: string): string {
    if (!iso) return '—';
    const dt = new Date(iso);
    const date = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${date} ${time}`;
  }
}
