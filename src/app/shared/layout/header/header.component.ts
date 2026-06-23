import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { DateService } from '../../../core/services/date.service';
import { HeaderService } from '../../../core/services/header.service';
import {
  NotificationItem,
  NotificationsService,
} from '../../../core/services/notifications.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AsyncPipe,
    ButtonModule,
    OverlayPanelModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  today: string;
  recentNotifications: NotificationItem[] = [];
  loadingNotifications = false;

  constructor(
    public auth: AuthServiceBase,
    private dateService: DateService,
    public headerService: HeaderService,
    public notifSvc: NotificationsService,
    private router: Router,
  ) {
    this.today = this.dateService.display(new Date(), "EEEE d 'de' MMMM, yyyy");
  }

  ngOnInit(): void {
    this.notifSvc.startPolling();
  }

  /** Se ejecuta al abrir el dropdown de la campana — fetch on-open de las últimas notificaciones. */
  onBellOpen(): void {
    this.loadingNotifications = true;
    this.notifSvc.list(1, 10).subscribe({
      next: (page) => {
        this.recentNotifications = page.items;
        this.loadingNotifications = false;
      },
      error: () => {
        this.loadingNotifications = false;
      },
    });
  }

  /** Marca una notificación como leída y navega a la entidad asociada si existe. */
  onNotificationClick(item: NotificationItem): void {
    if (!item.read_at) {
      this.notifSvc.markRead(item.id).subscribe();
      item.read_at = new Date().toISOString();
    }

    const route = this.getNotificationRoute(item);
    if (route) {
      this.router.navigate(route);
    }
  }

  /** Borra una notificación individual del dropdown sin disparar navegación. */
  onDeleteNotification(event: MouseEvent, item: NotificationItem): void {
    event.stopPropagation();
    this.recentNotifications = this.recentNotifications.filter(
      (notification) => notification.id !== item.id,
    );
    this.notifSvc.delete(item.id).subscribe();
  }

  /** Borra todas las notificaciones visibles y persistidas del usuario. */
  onDeleteAllNotifications(): void {
    this.recentNotifications = [];
    this.notifSvc.deleteAll().subscribe();
  }

  /** Resuelve el deep-link soportado por cada tipo de entidad notificada. */
  private getNotificationRoute(item: NotificationItem): string[] | null {
    if (item.entity_type === 'credit' && item.entity_id) {
      return ['/admin/operations', item.entity_id];
    }
    if (item.entity_type === 'customer' && item.entity_id) {
      return ['/admin/clients', item.entity_id];
    }
    if (item.entity_type === 'payment') {
      return ['/admin/approvals'];
    }
    if (item.entity_type === 'business_day') {
      return ['/admin/cash-register'];
    }
    if (item.type === 'WEEKLY_REPORT') {
      return ['/admin/reports'];
    }
    return null;
  }
}
