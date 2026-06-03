import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CollectionAlerts } from '../../../collector/models/collection.model';

@Component({
  selector: 'app-collection-alerts-dialog',
  standalone: true,
  imports: [DatePipe, ButtonModule, DialogModule],
  templateUrl: './collection-alerts-dialog.component.html',
})
export class CollectionAlertsDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() alerts: CollectionAlerts | null = null;
  /** Cierra el dialog via two-way binding. */
  @Output() visibleChange = new EventEmitter<boolean>();

  overdueExpanded = true;
  unassignedExpanded = false;

  /**
   * Actualiza el estado de expansión cuando llegan nuevas alertas.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['alerts'] && this.alerts) {
      const hasOverdue = this.alerts.overdueNextVisits.length > 0;
      const hasUnassigned = this.alerts.unassignedCustomers.length > 0;
      this.overdueExpanded = hasOverdue;
      this.unassignedExpanded = !hasOverdue && hasUnassigned;
    }
  }
}
