import { AsyncPipe, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { DateService } from '../../../core/services/date.service';
import { HeaderService } from '../../../core/services/header.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AsyncPipe,
    ButtonModule,
    BadgeModule,
    BreadcrumbModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  today: string;

  constructor(
    public auth: AuthServiceBase,
    private dateService: DateService,
    public headerService: HeaderService,
    private router: Router,
  ) {
    this.today = this.dateService.display(new Date(), "EEEE d 'de' MMMM, yyyy");
  }

  navigate(route: string): void {
    this.router.navigateByUrl(route);
  }
}
