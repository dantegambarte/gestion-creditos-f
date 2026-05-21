import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../core/models/app-error';
import { HeaderService } from '../../../../core/services/header.service';
import { CollectionsService } from '../../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionAlerts,
  CollectionFilter,
  CollectionGeneratePayload,
  CollectionGenerateResult,
} from '../../../collector/models/collection.model';
import { User } from '../../users/user.model';
import { UsersService } from '../../users/users.service';

@Component({
  selector: 'app-collection-generate',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    MessageModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './collection-generate.component.html',
})
export class CollectionGenerateComponent implements OnInit {
  private readonly collectionsService = inject(CollectionsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);

  collectors: User[] = [];
  selectedCollectorId = '';
  selectedDate = new Date().toISOString().split('T')[0];
  selectedFilter: CollectionFilter = 'TODAY';
  processing = false;

  /** Resultado de la última generación (incluye alertas operativas). */
  result: CollectionGenerateResult | null = null;
  alertsOverdueExpanded = true;
  alertsUnassignedExpanded = false;

  readonly FILTER_OPTIONS = (
    Object.keys(COLLECTION_FILTER_LABELS) as CollectionFilter[]
  ).map((k) => ({ label: COLLECTION_FILTER_LABELS[k], value: k }));

  get collectorOptions(): { label: string; value: string }[] {
    return this.collectors.map((c) => ({ label: c.fullName, value: c.id }));
  }

  get isValid(): boolean {
    return (
      !!this.selectedCollectorId && !!this.selectedDate && !!this.selectedFilter
    );
  }

  get alerts(): CollectionAlerts | null {
    return this.result?.alerts ?? null;
  }

  get hasAlerts(): boolean {
    if (!this.alerts) return false;
    return (
      this.alerts.overdueNextVisits.length > 0 ||
      this.alerts.unassignedCustomers.length > 0
    );
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Planillas de cobro', route: '/admin/collections' },
      { label: 'Generar planilla' },
    ]);
    this.usersService.listCollectors().subscribe((c) => (this.collectors = c));
  }

  cancel(): void {
    this.router.navigate(['/admin/collections']);
  }

  /**
   * Tras generar, no autonavega: muestra las alertas y deja al admin navegar
   * manualmente cuando termine de revisarlas (directiva UX prioritaria).
   */
  confirm(): void {
    if (!this.isValid || this.processing) return;
    this.processing = true;
    this.result = null;
    const payload: CollectionGeneratePayload = {
      collectorId: this.selectedCollectorId,
      date: this.selectedDate,
      filter: this.selectedFilter,
    };
    this.collectionsService.generate(payload).subscribe({
      next: (res) => {
        this.processing = false;
        this.result = res;
        const hasOverdue = res.alerts.overdueNextVisits.length > 0;
        const hasUnassigned = res.alerts.unassignedCustomers.length > 0;
        this.alertsOverdueExpanded = hasOverdue;
        this.alertsUnassignedExpanded = !hasOverdue && hasUnassigned;
        this.msg.add({
          severity: 'success',
          summary: 'Planilla generada',
          detail: hasOverdue || hasUnassigned
            ? 'Revisá las alertas antes de continuar.'
            : 'Sin alertas operativas.',
          life: 4000,
        });
      },
      error: (err: AppError) => {
        this.processing = false;
        const is409 = err.status === 409;
        const is404 = err.status === 404;
        this.msg.add({
          severity: is409 ? 'warn' : 'error',
          summary: is404 ? 'Cobrador inactivo' : is409 ? 'Sin cuotas' : 'Error',
          detail: err.message ?? 'No se pudo generar la planilla.',
          life: 6000,
        });
      },
    });
  }

  /**
   * Navega al detalle de la planilla recién generada.
   */
  viewSheet(): void {
    if (!this.result) return;
    this.router.navigate(['/admin/collections', this.result.sheet.id]);
  }

  /**
   * Resetea el resultado para permitir generar otra planilla sin recargar.
   */
  generateAnother(): void {
    this.result = null;
  }
}
