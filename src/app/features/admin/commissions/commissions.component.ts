import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ActiveTabScrollerDirective } from '../../../shared/directives/active-tab-scroller.directive';
import { CommissionsFacade } from './commissions.facade';
import { CommissionsHistoryTabComponent } from './history-tab/commissions-history-tab.component';
import { CommissionsLiquidationDialogsComponent } from './liquidation-dialogs/commissions-liquidation-dialogs.component';
import { CommissionsSalariesTabComponent } from './salaries-tab/commissions-salaries-tab.component';
import { CommissionsSummaryTabComponent } from './summary-tab/commissions-summary-tab.component';

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [
    ToastModule,
    CommissionsSummaryTabComponent,
    CommissionsHistoryTabComponent,
    CommissionsSalariesTabComponent,
    CommissionsLiquidationDialogsComponent,
    ActiveTabScrollerDirective,
  ],
  providers: [MessageService, CommissionsFacade],
  templateUrl: './commissions.component.html',
})
export class CommissionsComponent implements OnInit, OnDestroy {
  readonly vm = inject(CommissionsFacade);

  /**
   * Inicializa el estado de la pantalla a través del facade.
   */
  ngOnInit(): void {
    this.vm.init();
  }

  /**
   * Libera recursos del facade al destruir el componente.
   */
  ngOnDestroy(): void {
    this.vm.destroy();
  }
}
