import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  /** Marca una notificación como leída al hacer click sobre ella en el dropdown. */
  onNotificationClick(item: NotificationItem): void {
    if (!item.read_at) {
      this.notifSvc.markRead(item.id).subscribe();
      item.read_at = new Date().toISOString();
    }
  }
}
