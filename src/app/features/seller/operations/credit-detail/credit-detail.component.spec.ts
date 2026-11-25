import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
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
        { provide: AuthServiceBase, useValue: { hasRole: () => true, hasAnyRole: () => false } },
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

describe('CreditDetailComponent — etiquetas y totales', () => {
  let c: CreditDetailComponent;

  beforeEach(() => {
    const creditsSpy = jasmine.createSpyObj('CreditsService', ['getById']);
    creditsSpy.getById.and.returnValue(NEVER);
    TestBed.configureTestingModule({
      imports: [CreditDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: CreditsService, useValue: creditsSpy },
        { provide: PaymentsService, useValue: {} },
        { provide: HeaderService, useValue: jasmine.createSpyObj('HeaderService', ['set']) },
        {
          provide: AuthServiceBase,
          useValue: { hasRole: () => true, hasAnyRole: () => true },
        },
        { provide: CashStatusService, useValue: { resolve: () => of('OPEN') } },
      ],
    }).overrideComponent(CreditDetailComponent, { set: { template: '' } });
    c = TestBed.createComponent(CreditDetailComponent).componentInstance;
  });

  it('traduce estados, frecuencias y medios de pago', () => {
    expect(c.statusLabel('ACTIVE')).toBe('Activo');
    expect(c.statusSeverity('REJECTED')).toBe('danger');
    expect(c.frequencyLabel('WEEKLY')).toBe('Semanal');
    expect(c.frequencyLabel('OTHER')).toBe('OTHER');
    expect(c.frequencyUnitLabel('MONTHLY')).toBe('mes');
    expect(c.frequencyUnitLabel('OTHER')).toBe('');
    expect(c.paymentMethodLabel('MIXED')).toBe('Efectivo + Transferencia');
    expect(c.paymentMethodLabel(null)).toBe('Sin especificar');
    expect(c.variantLabel({ color: 'Rojo', size: 'M' } as never)).toBe('Rojo / M');
    expect(c.variantLabel({} as never)).toBe('—');
  });

  it('abre los diálogos de acción y actualiza cuotas en la lista', () => {
    c.openApproveDialog();
    c.openRejectDialog();
    c.openRefinanceDialog();
    c.openRenewDialog();
    c.openPlanChangeDialog();
    c.openWriteOffDialog();
    expect(c.showApproveDialog && c.showRejectDialog && c.showRefinanceDialog).toBeTrue();
    expect(c.showRenewDialog && c.showPlanChangeDialog && c.showWriteOffDialog).toBeTrue();

    c.credit = { installments: [{ id: 'i1', status: 'PENDING' }] } as never;
    c.updateInstallmentInList({ id: 'i1', status: 'PAID' } as never);
    const after = c.credit as unknown as { installments: { status: string }[] };
    expect(after.installments[0].status).toBe('PAID');
    expect(c.planAlreadyChanged).toBeFalse();
  });

  it('sin crédito cargado los totales y la cadena quedan vacíos', () => {
    expect(c.settlementTotalAmount).toBe(0);
    expect(c.totalToReturn).toBe(0);
    expect(c.totalInterest).toBe(0);
    expect(c.effectiveRate).toBeNull();
    expect(c.predecessorCreditId).toBeNull();
    expect(c.successorCreditId).toBeNull();
    expect(c.hasPendingPayments).toBeFalse();
    expect(c.installmentAmount).toBeNull();
  });

  it('calcula totales e interés con cuotas vigentes', () => {
    c.credit = {
      status: 'ACTIVE',
      financedAmount: 1000,
      interestRate: 0.5,
      installments: [
        { status: 'PENDING', amountDue: 600, amountPaid: 100 },
        { status: 'PAID', amountDue: 600, amountPaid: 600 },
        { status: 'WRITTEN_OFF', amountDue: 600, amountPaid: 0 },
      ],
    } as never;
    expect(c.totalToReturn).toBe(1200);
    expect(c.totalInterest).toBe(200);
    expect(c.settlementTotalAmount).toBe(500);
    expect(c.effectiveRate).toBe(0.5);
    expect(c.canActOnInstallments).toBeTrue();
    expect(c.canScheduleVisits).toBeTrue();
  });
});

describe('CreditDetailComponent — cancelación anticipada', () => {
  /** Crea el componente con la lista de pagos respondiendo según `list$`. */
  function create(list$: Observable<unknown>): CreditDetailComponent {
    const creditsSpy = jasmine.createSpyObj('CreditsService', ['getById']);
    creditsSpy.getById.and.returnValue(NEVER);
    TestBed.configureTestingModule({
      imports: [CreditDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: CreditsService, useValue: creditsSpy },
        { provide: PaymentsService, useValue: { listByCredit: () => list$ } },
        { provide: HeaderService, useValue: jasmine.createSpyObj('HeaderService', ['set']) },
        { provide: AuthServiceBase, useValue: { hasRole: () => true, hasAnyRole: () => true } },
        { provide: CashStatusService, useValue: { resolve: () => of('OPEN') } },
      ],
    }).overrideComponent(CreditDetailComponent, { set: { template: '' } });
    const c = TestBed.createComponent(CreditDetailComponent).componentInstance;
    c.credit = { id: 'c1' } as never;
    return c;
  }

  it('no abre el diálogo si no se pudieron cargar los pagos', () => {
    const c = create(throwError(() => new Error('500')));
    c.openSettlementDialog();
    expect(c.showSettlementDialog).toBeFalse();
  });

  it('abre el diálogo cuando los pagos cargan', () => {
    const c = create(of([]));
    c.openSettlementDialog();
    expect(c.showSettlementDialog).toBeTrue();
  });
});
