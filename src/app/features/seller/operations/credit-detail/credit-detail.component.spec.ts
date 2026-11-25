import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { HeaderService } from '../../../../core/services/header.service';
import { CashStatus, CashStatusService } from '../../../admin/cash-register/cash-status.service';
import { PaymentsService } from '../../../collector/payments.service';
import { CreditsService } from '../credits.service';
import { CreditDetailComponent } from './credit-detail.component';

describe('CreditDetailComponent — estado de caja', () => {
  /** Crea el componente (sin template) con el estado de caja indicado. */
  function create(status: CashStatus): CreditDetailComponent {
    const creditsSpy = jasmine.createSpyObj('CreditsService', ['getById', 'getPayments']);
    creditsSpy.getById.and.returnValue(NEVER);
    creditsSpy.getPayments.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [CreditDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: CreditsService, useValue: creditsSpy },
        { provide: PaymentsService, useValue: {} },
        {
          provide: HeaderService,
          useValue: jasmine.createSpyObj('HeaderService', ['set', 'reset']),
        },
        { provide: AuthServiceBase, useValue: { hasRole: () => true } },
        { provide: CashStatusService, useValue: { resolve: () => of(status) } },
      ],
    }).overrideComponent(CreditDetailComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(CreditDetailComponent);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  }

  it('un error de consulta queda como estado desconocido, no como caja cerrada', () => {
    const c = create('UNKNOWN');
    expect(c.isCashUnknown).toBeTrue();
    expect(c.isCashClosed).toBeFalse();
    expect(c.isApproveBlocked).toBeTrue();
  });

  it('sin caja abierta queda como caja cerrada', () => {
    const c = create('CLOSED');
    expect(c.isCashClosed).toBeTrue();
    expect(c.isCashUnknown).toBeFalse();
    expect(c.isApproveBlocked).toBeTrue();
  });

  it('con caja abierta no bloquea', () => {
    const c = create('OPEN');
    expect(c.isApproveBlocked).toBeFalse();
  });
});
