import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { FfBackTopFabComponent } from '../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  COLLECTION_FILTER_LABELS,
  CollectionFilter,
  CollectionSheet,
} from '../../../collector/models/collection.model';

@Component({
  selector: 'app-sheet-history',
  standalone: true,
  imports: [TableModule, ButtonModule, SkeletonModule, LoadingStateComponent, FfBackTopFabComponent],
  templateUrl: './sheet-history.component.html',
})
export class SheetHistoryComponent {
  @Input() historial: CollectionSheet[] = [];
  @Input() loading = false;
  /** Emite cuando el usuario solicita recargar el historial. */
  @Output() refresh = new EventEmitter<void>();
  /** Emite el ID de la planilla cuando el usuario solicita ver su detalle. */
  @Output() viewDetails = new EventEmitter<string>();
  /** Emite el ID de la planilla cuando el usuario solicita reenviarla. */
  @Output() send = new EventEmitter<string>();

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
   * Devuelve la etiqueta legible del filtro de cuotas.
   * @param filter clave del filtro
   */
  filterLabel(filter: CollectionFilter): string {
    return COLLECTION_FILTER_LABELS[filter] ?? filter;
  }
}
