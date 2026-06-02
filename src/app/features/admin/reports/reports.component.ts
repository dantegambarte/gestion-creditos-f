import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderService } from '../../../core/services/header.service';
import { ReportTab } from './report.models';
import { CollectionReportComponent } from './tabs/collection-report/collection-report.component';
import { CollectorsReportComponent } from './tabs/collectors-report/collectors-report.component';
import { OverdueReportComponent } from './tabs/overdue-report/overdue-report.component';
import { PortfolioReportComponent } from './tabs/portfolio-report/portfolio-report.component';
import { ProductsReportComponent } from './tabs/products-report/products-report.component';
import { SummaryReportComponent } from './tabs/summary-report/summary-report.component';
import { UpcomingReportComponent } from './tabs/upcoming-report/upcoming-report.component';
import { CashConversionsReportComponent } from './tabs/cash-conversions-report/cash-conversions-report.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    SummaryReportComponent,
    CollectionReportComponent,
    PortfolioReportComponent,
    OverdueReportComponent,
    CollectorsReportComponent,
    ProductsReportComponent,
    UpcomingReportComponent,
    CashConversionsReportComponent,
  ],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private readonly header = inject(HeaderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  activeTab: ReportTab = 'summary';
  returnTo: string | null = null;

  readonly TABS: { id: ReportTab; label: string; icon: string }[] = [
    { id: 'summary', label: 'Resumen del día', icon: 'pi pi-sun' },
    { id: 'collection', label: 'Recaudación', icon: 'pi pi-money-bill' },
    { id: 'portfolio', label: 'Cartera', icon: 'pi pi-briefcase' },
    { id: 'overdue', label: 'Mora', icon: 'pi pi-exclamation-triangle' },
    { id: 'collectors', label: 'Cobradores', icon: 'pi pi-users' },
    { id: 'products', label: 'Productos', icon: 'pi pi-box' },
    { id: 'upcoming', label: 'Próximos vencimientos', icon: 'pi pi-calendar' },
    { id: 'cashConversions', label: 'Conversiones de caja', icon: 'pi pi-sync' },
  ];

  ngOnInit(): void {
    this.header.set([{ label: 'Reportes' }]);
    document.addEventListener('report-tab-change', this.onTabChange);
    this.syncTabFromQueryParams();
  }

  ngOnDestroy(): void {
    this.header.reset();
    document.removeEventListener('report-tab-change', this.onTabChange);
  }

  /**
   * Cambia la pestaña activa al valor recibido.
   * @param tab - identificador de la pestaña destino
   */
  setTab(tab: ReportTab): void {
    this.activeTab = tab;
  }

  /**
   * Manejador del evento global `report-tab-change` emitido por hijos que necesitan cambiar de pestaña.
   * @param event - CustomEvent con el ReportTab destino
   */
  private onTabChange = (event: Event): void => {
    this.activeTab = (event as CustomEvent<ReportTab>).detail;
  };

  /**
   * Sincroniza la pestaña activa con el query param `tab` cuando existe y es válido.
   */
  private syncTabFromQueryParams(): void {
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    const tab = this.route.snapshot.queryParamMap.get('tab') as ReportTab | null;
    if (!tab) return;
    if (this.TABS.some((t) => t.id === tab)) {
      this.activeTab = tab;
    }
  }

  /**
   * Vuelve a la pantalla origen cuando el acceso vino por navegación contextual.
   */
  goBackToOrigin(): void {
    if (!this.returnTo) return;
    this.router.navigateByUrl(this.returnTo);
  }
}
