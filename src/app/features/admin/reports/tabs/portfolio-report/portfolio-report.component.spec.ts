import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NEVER } from 'rxjs';
import { PortfolioReport } from '../../report.models';
import { ReportsService } from '../../reports.service';
import { PortfolioReportComponent } from './portfolio-report.component';

describe('PortfolioReportComponent — totales y estados (#62)', () => {
  let component: PortfolioReportComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortfolioReportComponent],
      providers: [{ provide: ReportsService, useValue: { getPortfolioReport: () => NEVER } }],
    }).overrideComponent(PortfolioReportComponent, {
      set: { template: '', schemas: [NO_ERRORS_SCHEMA] },
    });
    component = TestBed.createComponent(PortfolioReportComponent).componentInstance;
    component.portfolioReport = {
      byStatusType: [
        { status: 'ACTIVE', type: 'SALE', totalAmount: 600 },
        { status: 'PENDING_APPROVAL', type: 'LOAN', totalAmount: 400 },
        { status: 'SETTLED', type: 'SALE', totalAmount: 5000 },
        { status: 'REJECTED', type: 'LOAN', totalAmount: 7000 },
        { status: 'WRITTEN_OFF', type: 'LOAN', totalAmount: 50 },
      ],
    } as unknown as PortfolioReport;
  });

  it('el total de porcentajes excluye créditos liquidados y rechazados', () => {
    expect(component.portfolioGrandTotal).toBe(1050);
  });

  it('no descarta estados que no están en la lista conocida', () => {
    expect(component.portfolioGrouped.map((g) => g.status)).toEqual([
      'ACTIVE',
      'SETTLED',
      'PENDING_APPROVAL',
      'REJECTED',
      'WRITTEN_OFF',
    ]);
  });
});
