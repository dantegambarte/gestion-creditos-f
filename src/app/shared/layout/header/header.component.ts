import { AsyncPipe, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
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
  ) {
    this.today = this.dateService.display(new Date(), "EEEE d 'de' MMMM, yyyy");
  }
}
