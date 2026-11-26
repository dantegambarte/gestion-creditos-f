import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardChartsComponent } from './dashboard-charts.component';
import { ReportsService } from '../../reports/reports.service';

describe('DashboardChartsComponent', () => {
  let fixture: ComponentFixture<DashboardChartsComponent>;
  let component: DashboardChartsComponent;
  let reports: jasmine.SpyObj<ReportsService>;

  beforeEach(() => {
    reports = jasmine.createSpyObj('ReportsService', ['getCollectorsReport', 'getSellersReport']);
    TestBed.configureTestingModule({
      imports: [DashboardChartsComponent],
      providers: [{ provide: ReportsService, useValue: reports }],
    });
    fixture = TestBed.createComponent(DashboardChartsComponent);
    component = fixture.componentInstance;
  });

  /** Dispara la carga como lo hace el padre al pasar los datos diarios. */
  function trigger(): void {
    component.monthlyDailyData = [];
    component.ngOnChanges({ monthlyDailyData: new SimpleChange(null, [], true) });
    fixture.detectChanges();
  }

  it('con 500 muestra estado de error con reintento, no gráficos vacíos', () => {
    reports.getCollectorsReport.and.returnValue(throwError(() => ({ status: 500 })));
    reports.getSellersReport.and.returnValue(of([] as any));
    trigger();
    expect(component.errorCharts).toBeTrue();
    expect(component.loadingCharts).toBeFalse();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-cy="dashboard-charts-error"]')).not.toBeNull();
    expect(el.querySelector('[data-cy="error-state-retry"]')).not.toBeNull();
  });

  it('con 200 muestra los gráficos y reintentar recupera tras un error', () => {
    reports.getCollectorsReport.and.returnValue(throwError(() => ({ status: 500 })));
    reports.getSellersReport.and.returnValue(of([] as any));
    trigger();
    reports.getCollectorsReport.and.returnValue(
      of([{ collectorName: 'Luis', totalCollected: 100 }] as any),
    );
    component.loadCharts();
    fixture.detectChanges();
    expect(component.errorCharts).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-cy="dashboard-charts-error"]')).toBeNull();
  });
});
