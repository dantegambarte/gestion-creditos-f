import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { finalize } from 'rxjs/operators';
import { FormatService } from '../../../../core/services/format.service';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { CashSessionSnapshot } from '../../models/cash-session.model';
import { CashRegisterService } from '../cash-register.service';

/**
 * V4: dialog read-only que muestra el snapshot vivo (X report) de una caja
 * operativa. Sirve al cajero para ver "cuánto debería tener" antes de
 * declarar al cierre.
 */
@Component({
  selector: 'app-cash-session-snapshot-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, LoadingStateComponent],
  templateUrl: './cash-session-snapshot-dialog.component.html',
})
export class CashSessionSnapshotDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() sessionId: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();

  private readonly service = inject(CashRegisterService);
  readonly format = inject(FormatService);

  snapshot: CashSessionSnapshot | null = null;
  loading = false;
  errorMessage: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.sessionId) {
      this.load();
    }
  }

  load(): void {
    if (!this.sessionId) return;
    this.loading = true;
    this.errorMessage = null;
    this.snapshot = null;

    this.service
      .getSessionSnapshot(this.sessionId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (snap) => (this.snapshot = snap),
        error: (err) => (this.errorMessage = err?.message || 'No se pudo cargar el snapshot.'),
      });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
