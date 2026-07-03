import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { DateService } from '../../../../../core/services/date.service';
import { CollectionAttemptsService } from '../../../../collector/collection-attempts.service';
import { CreditDetail } from '../../../models/credit.model';

/**
 * Diálogo de gestión administrativa: el admin programa una visita sobre una
 * cuota no pagada (PENDING/PARTIAL/OVERDUE) cuando el cliente avisa antes.
 * Reutiliza la entidad de gestión existente (collection_attempts) vía
 * CollectionAttemptsService con attemptType 'SCHEDULED_VISIT'. La visita queda
 * agendada con next_visit_date y el backend la incorpora a la planilla de esa
 * fecha. No modifica la cuota ni su vencimiento.
 */
@Component({
  selector: 'app-schedule-visit-dialog',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyArsPipe,
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    InputTextareaModule,
  ],
  templateUrl: './schedule-visit-dialog.component.html',
})
export class ScheduleVisitDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() installment: CreditDetail['installments'][number] | null = null;
  /** Emite cuando la visita fue programada con éxito (el padre puede refrescar). */
  @Output() scheduled = new EventEmitter<void>();

  visitDate = '';
  notes = '';
  processing = false;

  private readonly attemptsSvc = inject(CollectionAttemptsService);
  private readonly msg = inject(MessageService);
  private readonly dateSvc = inject(DateService);

  readonly todayDate: Date = this.dateSvc.startOfToday();
  get todayIso(): string {
    return this.dateSvc.toLocalIso(new Date());
  }

  /** Resetea el formulario cada vez que se abre el diálogo. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.visitDate = '';
      this.notes = '';
    }
  }

  get formValid(): boolean {
    return (
      !!this.installment &&
      !!this.visitDate &&
      this.visitDate >= this.todayIso &&
      !!this.notes.trim()
    );
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Registra la visita programada reutilizando el endpoint de gestiones.
   */
  confirm(): void {
    if (this.processing || !this.formValid || !this.installment) return;
    this.processing = true;

    this.attemptsSvc
      .create({
        installmentId: this.installment.id,
        attemptType: 'SCHEDULED_VISIT',
        nextVisitDate: this.visitDate,
        notes: this.notes.trim(),
      })
      .subscribe({
        next: () => {
          this.processing = false;
          this.close();
          this.msg.add({
            severity: 'success',
            summary: 'Visita programada',
            detail: `Programada para el ${this.formatDate(this.visitDate)}.`,
            life: 4000,
          });
          this.scheduled.emit();
        },
        error: (err: AppError) => {
          this.processing = false;
          this.msg.add({
            severity:
              err.status === 409 || err.status === 422 ? 'warn' : 'error',
            summary:
              err.status === 403
                ? 'Sin acceso'
                : err.status === 422
                  ? 'Datos inválidos'
                  : err.status === 409
                    ? 'Advertencia'
                    : 'Error',
            detail: err.message ?? 'No se pudo programar la visita.',
          });
        },
      });
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
