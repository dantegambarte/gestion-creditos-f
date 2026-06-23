import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import {
  NotificationHistoryPage,
  NotificationPreference,
  NotificationType,
  NotificationsService,
} from '../../../../core/services/notifications.service';

interface NotifSetting {
  id: NotificationType;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  emailEnabled: boolean;
}

/** Metadata estática (label/descripción/icono) por tipo — el backend solo conoce enabled/email_enabled/frequency. */
const SETTING_META: Record<NotificationType, Omit<NotifSetting, 'enabled' | 'emailEnabled'>> = {
  MORA: {
    id: 'MORA',
    label: 'Alertas de mora',
    description: 'Notificar cuando un crédito entra en período de mora',
    icon: 'pi pi-exclamation-triangle',
  },
  INSTALLMENT_DUE: {
    id: 'INSTALLMENT_DUE',
    label: 'Vencimiento de cuotas',
    description: 'Recordatorio 3 días antes del vencimiento de cuotas',
    icon: 'pi pi-calendar',
  },
  APPROVAL_REQUEST: {
    id: 'APPROVAL_REQUEST',
    label: 'Solicitudes de aprobación',
    description: 'Notificar nuevas solicitudes pendientes de aprobación',
    icon: 'pi pi-check-square',
  },
  CASH_REGISTER: {
    id: 'CASH_REGISTER',
    label: 'Cierre de caja',
    description: 'Recordatorio diario para el cierre de caja',
    icon: 'pi pi-wallet',
  },
  NEW_CUSTOMER: {
    id: 'NEW_CUSTOMER',
    label: 'Nuevo cliente registrado',
    description: 'Notificar al admin cuando se registra un nuevo cliente',
    icon: 'pi pi-user-plus',
  },
  WEEKLY_REPORT: {
    id: 'WEEKLY_REPORT',
    label: 'Informes automáticos',
    description: 'Enviar resumen semanal de operaciones por email',
    icon: 'pi pi-chart-bar',
  },
};

@Component({
  selector: 'app-notifications-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputSwitchModule, SkeletonModule],
  templateUrl: './notifications-config.component.html',
})
export class NotificationsConfigComponent implements OnInit {
  private readonly notificationsSvc = inject(NotificationsService);

  settings: NotifSetting[] = [];
  history: NotificationHistoryPage['items'] = [];
  loading = false;
  saving = false;

  ngOnInit(): void {
    this.loadPreferences();
    this.loadHistory();
  }

  /** Carga las 6 preferencias reales desde el backend y las mapea a NotifSetting. */
  private loadPreferences(): void {
    this.loading = true;
    this.notificationsSvc.getPreferences().subscribe({
      next: (prefs: NotificationPreference[]) => {
        this.settings = prefs.map((p) => ({
          ...SETTING_META[p.type],
          enabled: p.enabled,
          emailEnabled: p.email_enabled,
        }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  /** Carga las últimas notificaciones para la tabla "Historial de Alertas". */
  private loadHistory(): void {
    this.notificationsSvc.list(1, 10).subscribe({
      next: (page) => (this.history = page.items),
      error: () => (this.history = []),
    });
  }

  /** Persiste las preferencias modificadas — una llamada PUT por tipo. */
  save(): void {
    if (this.loading || this.settings.length === 0) return;

    this.saving = true;
    const updates = this.settings.map((s) =>
      this.notificationsSvc.updatePreference(s.id, {
        enabled: s.enabled,
        email_enabled: s.emailEnabled,
      }),
    );
    // Disparamos todas las actualizaciones; no usamos forkJoin para mantener
    // este componente sin dependencias extra de rxjs — cada PUT es independiente.
    let remaining = updates.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) this.saving = false;
    };
    updates.forEach((obs) => obs.subscribe({ next: done, error: done }));
  }
}
