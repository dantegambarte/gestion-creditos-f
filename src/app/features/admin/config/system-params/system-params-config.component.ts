import { DatePipe } from '@angular/common';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import {
  ParamMeta,
  SystemConfigParam,
} from '../models/interfaces/system-config.model';
import { SystemConfigService } from '../services/system-config.service';

const PARAM_META: Record<string, ParamMeta> = {
  commission_rate: {
    label: 'Tasa de comisión (%)',
    range: '0 – 1',
    hint: 'Ej: 0.08 = 8%',
    min: 0,
    max: 1,
  },
  penalty_grace_days: {
    label: 'Días de gracia para mora',
    range: '0 – 30',
    hint: 'Días tras vencimiento antes de aplicar mora',
    min: 0,
    max: 30,
  },
  penalty_rate_daily: {
    label: 'Tasa diaria de mora (%)',
    range: '0 – 0.5',
    hint: 'Ej: 0.005 = 0.5% diario',
    min: 0,
    max: 0.5,
  },
  penalty_max_rate: {
    label: 'Tope máximo de mora (%)',
    range: '0 – 1',
    hint: 'Ej: 0.50 = 50% del monto original',
    min: 0,
    max: 1,
  },
  credit_expiry_days: {
    label: 'Días expiración crédito',
    range: '1 – 365',
    hint: 'Días en pendiente antes de expirar',
    min: 1,
    max: 365,
  },
  min_credit_amount: {
    label: 'Monto mínimo de crédito ($)',
    range: '1 – 999.999',
    hint: '',
    min: 1,
    max: 999999,
  },
  max_credit_amount: {
    label: 'Monto máximo de crédito ($)',
    range: '1 – 99.999.999',
    hint: '',
    min: 1,
    max: 99999999,
  },
  jwt_expiry_internal_hs: {
    label: 'Expiración JWT interno (hs)',
    range: '0.08 – 72',
    hint: 'Ej: 0.25 = 15 min · 1 = 1 hs',
    min: 0.08,
    max: 72,
  },
  jwt_expiry_portal_min: {
    label: 'Expiración JWT portal (min)',
    range: '5 – 1440',
    hint: '',
    min: 5,
    max: 1440,
  },
  login_max_attempts: {
    label: 'Intentos fallidos de login',
    range: '1 – 10',
    hint: '',
    min: 1,
    max: 10,
  },
  commission_week_close_day: {
    label: 'Día cierre semana comisiones',
    range: '1 – 7',
    hint: '',
    min: 1,
    max: 7,
  },
  commission_pay_day: {
    label: 'Día de pago de comisiones',
    range: '1 – 7',
    hint: '',
    min: 1,
    max: 7,
  },
};

export interface ParamRow extends SystemConfigParam {
  meta: ParamMeta;
}

@Component({
  selector: 'app-system-params-config',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    SkeletonModule,
    TableModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './system-params-config.component.html',
})
export class SystemParamsConfigComponent implements OnInit {
  private readonly svc = inject(SystemConfigService);
  private readonly msg = inject(MessageService);

  loading = true;
  saving = false;
  rows: ParamRow[] = [];

  showEditDialog = false;
  editingRow: ParamRow | null = null;
  editValue: number | null = null;
  editError = '';

  readonly dayOptions = [
    { label: 'Lunes', value: 1 },
    { label: 'Martes', value: 2 },
    { label: 'Miércoles', value: 3 },
    { label: 'Jueves', value: 4 },
    { label: 'Viernes', value: 5 },
    { label: 'Sábado', value: 6 },
    { label: 'Domingo', value: 7 },
  ];

  readonly DAY_PARAMS = new Set([
    'commission_week_close_day',
    'commission_pay_day',
  ]);

  showConfirmDialog = false;
  confirmMessage = '';
  private pendingAction: (() => void) | null = null;

  ngOnInit(): void {
    this.load();
  }

  /**
   * Carga los parámetros del sistema desde el servicio, manejando el estado de carga y mostrando mensajes de error en caso de fallo.
   */
  private load(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: (params) => {
        this.rows = params.map((p) => ({
          ...p,
          meta: PARAM_META[p.key] ?? {
            label: p.key,
            range: '–',
            hint: '',
            min: 0,
            max: 999999,
          },
        }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los parámetros.',
        });
      },
    });
  }

  /**
   * Formatea el valor crudo del parámetro en un string legible para el usuario.
   */
  formatValue(row: ParamRow): string {
    const v = parseFloat(row.value);
    const DAYS = [
      '',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];
    switch (row.key) {
      case 'commission_rate':
      case 'penalty_rate_daily':
      case 'penalty_max_rate':
        return (v * 100).toFixed(2).replace(/\.00$/, '') + '%';
      case 'penalty_grace_days':
      case 'credit_expiry_days':
        return `${v} días`;
      case 'min_credit_amount':
      case 'max_credit_amount':
        return '$' + v.toLocaleString('es-AR');
      case 'jwt_expiry_internal_hs':
        return `${v} hs`;
      case 'jwt_expiry_portal_min':
        return `${v} min`;
      case 'login_max_attempts':
        return `${v} intentos`;
      case 'commission_week_close_day':
      case 'commission_pay_day':
        return `${DAYS[v] ?? v} (${v})`;
      default:
        return row.value;
    }
  }

  /**
   * Abre el diálogo de edición para un parámetro específico.
   * @param row
   */
  openEdit(row: ParamRow): void {
    this.editingRow = row;
    this.editValue = parseFloat(row.value);
    this.editError = '';
    this.showEditDialog = true;
  }

  /**
   * Envía los cambios realizados en un parámetro de edición.
   * @returns
   */
  submitEdit(): void {
    if (!this.editingRow || this.editValue == null) return;
    this.saving = true;
    this.editError = '';
    this.svc
      .update(this.editingRow.key, { value: String(this.editValue) })
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.showEditDialog = false;
          this.replaceRow({ ...updated, meta: this.editingRow!.meta });
          this.msg.add({
            severity: 'success',
            summary: 'Guardado',
            detail: 'Parámetro actualizado.',
          });
        },
        error: (err: AppError) => {
          this.saving = false;
          this.editError = err.message;
        },
      });
  }

  /**
   * Confirma la restauración de un parámetro a su valor por defecto.
   * @param row
   */
  confirmReset(row: ParamRow): void {
    this.confirmMessage = `¿Restaurar "${row.meta.label}" al valor por defecto?`;
    this.pendingAction = () => this.executeReset(row);
    this.showConfirmDialog = true;
  }

  /**
   * Ejecuta la restauración de un parámetro a su valor por defecto.
   * @param row
   */
  private executeReset(row: ParamRow): void {
    this.svc.resetToDefault(row.key).subscribe({
      next: (updated) => {
        this.replaceRow({ ...updated, meta: row.meta });
        this.msg.add({
          severity: 'success',
          summary: 'Restaurado',
          detail: `"${row.meta.label}" restaurado al valor por defecto.`,
        });
      },
      error: (err: AppError) => {
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message,
        });
      },
    });
  }

  /**
   * Maneja la confirmación de la acción en el diálogo de confirmación, ejecutando la acción pendiente si existe y cerrando el diálogo.
   */
  onConfirm(): void {
    this.showConfirmDialog = false;
    this.pendingAction?.();
    this.pendingAction = null;
  }

  /**
   * Maneja la cancelación de la acción en el diálogo de confirmación, simplemente cerrando el diálogo y limpiando la acción pendiente.
   */
  onCancelConfirm(): void {
    this.showConfirmDialog = false;
    this.pendingAction = null;
  }

  /**
   * Reemplaza un row en la lista de rows.
   * @param updated
   */
  private replaceRow(updated: ParamRow): void {
    this.rows = this.rows.map((r) => (r.key === updated.key ? updated : r));
  }
}
