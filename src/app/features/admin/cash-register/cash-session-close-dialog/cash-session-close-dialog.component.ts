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
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule } from 'primeng/skeleton';
import { finalize } from 'rxjs/operators';
import { FormatService } from '../../../../core/services/format.service';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import {
  CashSession,
  CashSessionSnapshot,
  DECLARED_PAYMENT_METHODS,
  DeclaredItem,
  DeclaredPaymentMethod,
} from '../../models/cash-session.model';
import { CashRegisterService } from '../cash-register.service';

interface DeclaredRow {
  method: DeclaredPaymentMethod;
  label: string;
  declared: number | null;
  expected: number;
  difference: number;
}

/**
 * V4: dialog de cierre de caja operativa.
 *
 * Renderiza inputs declared dinámicamente por método de pago (CASH, TRANSFER,
 * MP, QR, CHECK, OTHER — desde DECLARED_PAYMENT_METHODS). Muestra Esperado,
 * Declarado y Diferencia en vivo por método y totales.
 *
 * Solo dos métodos tienen "esperado" desde el snapshot (CASH y TRANSFER); los
 * demás métodos quedan en expected=0 a menos que el snapshot evolucione.
 */
@Component({
  selector: 'app-cash-session-close-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
    SkeletonModule,
  ],
  templateUrl: './cash-session-close-dialog.component.html',
})
export class CashSessionCloseDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() sessionId: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closedSuccessfully = new EventEmitter<CashSession>();

  private readonly service = inject(CashRegisterService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);

  snapshot: CashSessionSnapshot | null = null;
  loadingSnapshot = false;
  rows: DeclaredRow[] = [];
  observations = '';
  submitting = false;
  errorMessage: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.sessionId) {
      this.loadSnapshot();
    }
  }

  loadSnapshot(): void {
    if (!this.sessionId) return;
    this.loadingSnapshot = true;
    this.errorMessage = null;
    this.snapshot = null;
    this.observations = '';

    this.service
      .getSessionSnapshot(this.sessionId)
      .pipe(finalize(() => (this.loadingSnapshot = false)))
      .subscribe({
        next: (snap) => {
          this.snapshot = snap;
          this.buildRows(snap);
        },
        error: (err) => {
          this.errorMessage = err?.message || 'No se pudo cargar el snapshot.';
        },
      });
  }

  private buildRows(snap: CashSessionSnapshot): void {
    this.rows = DECLARED_PAYMENT_METHODS.map(({ value, label }) => {
      const expected =
        value === 'CASH'     ? snap.expected.cash :
        value === 'TRANSFER' ? snap.expected.transfer : 0;
      return {
        method: value,
        label,
        declared: null,
        expected,
        difference: -expected,
      };
    });
  }

  onDeclaredChange(row: DeclaredRow): void {
    const d = row.declared ?? 0;
    row.difference = d - row.expected;
  }

  get totalDeclared(): number {
    return this.rows.reduce((acc, r) => acc + (r.declared ?? 0), 0);
  }

  get totalExpected(): number {
    return this.rows.reduce((acc, r) => acc + r.expected, 0);
  }

  get totalDifference(): number {
    return this.totalDeclared - this.totalExpected;
  }

  canSubmit(): boolean {
    if (this.submitting || !this.sessionId || !this.snapshot) return false;
    // Al menos un método debe tener un declared informado (acepta 0).
    return this.rows.some((r) => r.declared != null);
  }

  submit(): void {
    if (!this.canSubmit() || !this.sessionId) return;
    this.submitting = true;
    this.errorMessage = null;

    const declared: DeclaredItem[] = this.rows
      .filter((r) => r.declared != null)
      .map((r) => ({
        payment_method:  r.method,
        declared_amount: r.declared!,
      }));

    this.service
      .closeSession(this.sessionId, { declared })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (session) => {
          this.msg.add({
            severity: 'success',
            summary: 'Caja cerrada',
            detail: `Caja operativa #${session.id.slice(0, 8)} cerrada correctamente.`,
          });
          this.closedSuccessfully.emit(session);
          this.close();
        },
        error: (err) => {
          this.errorMessage = err?.message || 'No se pudo cerrar la caja.';
        },
      });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
