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
}

/** Metadata estática (label/descripción/icono) por tipo — el backend solo conoce enabled/frequency. */
const SETTING_META: Record<NotificationType, Omit<NotifSetting, 'enabled'>> = {
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
};

/** Verifica que una preferencia recibida por API tenga metadata visual soportada. */
const isKnownNotificationType = (type: string): type is NotificationType =>
  type in SETTING_META;

@Component({
  selector: 'app-notifications-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputSwitchModule,
    SkeletonModule,
  ],
  templateUrl: './notifications-config.component.html',
})
export class NotificationsConfigComponent implements OnInit {
  private readonly notificationsSvc = inject(NotificationsService);

  settings: NotifSetting[] = [];
  history: NotificationHistoryPage['items'] = [];
  loading = false;
  saving = false;
  hasChanges = false;
  private originalEnabled = new Map<NotificationType, boolean>();

  ngOnInit(): void {
    this.loadPreferences();
    this.loadHistory();
  }

  /** Carga las 5 preferencias reales desde el backend y descarta tipos desconocidos. */
  private loadPreferences(): void {
    this.loading = true;
    this.notificationsSvc.getPreferences().subscribe({
      next: (prefs: NotificationPreference[]) => {
        this.settings = prefs.reduce<NotifSetting[]>((settings, p) => {
          if (!isKnownNotificationType(p.type)) return settings;

          const meta = SETTING_META[p.type];

          settings.push({
            ...meta,
            enabled: p.enabled,
          });
          return settings;
        }, []);
        this.captureOriginalState();
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

  /** Recalcula si hay cambios pendientes contra el estado cargado desde backend. */
  onSettingChange(): void {
    this.hasChanges = this.settings.some(
      (setting) => this.originalEnabled.get(setting.id) !== setting.enabled,
    );
  }

  /** Persiste solo las preferencias modificadas en una única request batch. */
  save(): void {
    if (this.loading || this.saving || !this.hasChanges) return;

    const updates = this.settings
      .filter(
        (setting) => this.originalEnabled.get(setting.id) !== setting.enabled,
      )
      .map((setting) => ({
        type: setting.id,
        enabled: setting.enabled,
      }));

    if (updates.length === 0) return;

    this.saving = true;
    this.notificationsSvc.updatePreferences(updates).subscribe({
      next: (updatedPreferences) => {
        const updatedByType = new Map(
          updatedPreferences.map((preference) => [preference.type, preference]),
        );
        this.settings = this.settings.map((setting) => {
          const updated = updatedByType.get(setting.id);
          return updated ? { ...setting, enabled: updated.enabled } : setting;
        });
        this.captureOriginalState();
        this.saving = false;
      },
      error: () => {
        this.saving = false;
      },
    });
  }

  /** Guarda el snapshot local usado para detectar cambios pendientes. */
  private captureOriginalState(): void {
    this.originalEnabled = new Map(
      this.settings.map((setting) => [setting.id, setting.enabled]),
    );
    this.hasChanges = false;
  }
}
