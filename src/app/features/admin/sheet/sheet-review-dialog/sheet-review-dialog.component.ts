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
import { TableModule } from 'primeng/table';
import { FormatService } from '../../../../core/services/format.service';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { CollectionsService } from '../../../collector/collections.service';
import { CollectionSheetDetail } from '../../../collector/models/collection.model';

@Component({
  selector: 'app-sheet-review-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, TableModule, LoadingStateComponent],
  templateUrl: './sheet-review-dialog.component.html',
})
export class SheetReviewDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** ID de la planilla a cargar cuando el dialog se abre. */
  @Input() sheetId: string | null = null;
  /** Emite el ID de la planilla cuando el usuario solicita enviarla. */
  @Output() sendRequested = new EventEmitter<string>();
  /** Emite el detalle cargado cuando el usuario solicita descargar el PDF. */
  @Output() downloadRequested = new EventEmitter<CollectionSheetDetail>();

  private readonly collectionsService = inject(CollectionsService);
  readonly format = inject(FormatService);

  reviewSheetDetail: CollectionSheetDetail | null = null;
  loadingReview = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.sheetId) {
      this.reviewSheetDetail = null;
      this.loadingReview = true;
      this.collectionsService.getById(this.sheetId).subscribe({
        next: (detail) => {
          this.reviewSheetDetail = detail;
          this.loadingReview = false;
        },
        error: () => {
          this.loadingReview = false;
          this.visibleChange.emit(false);
        },
      });
    }
  }

  /**
   * Formatea una fecha ISO al formato dd/mm/yyyy.
   * @param iso fecha en formato ISO
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Formatea un valor numérico como moneda.
   * @param value monto a formatear
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }
}
