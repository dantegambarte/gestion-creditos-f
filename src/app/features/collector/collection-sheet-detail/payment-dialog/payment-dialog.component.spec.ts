import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import {
  CollectionSheetItem,
  CollectionSheetItemLive,
} from '../../models/collection.model';
import { PaymentsService } from '../../payments.service';
import { PaymentDialogComponent } from './payment-dialog.component';

/**
 * Arma una cuota de planilla con snapshot 1000 y la capa viva indicada.
 * @param live Capa viva (null = planilla read-only).
 */
function buildItem(
  live: Partial<CollectionSheetItemLive> | null,
): CollectionSheetItem {
  return {
    installmentId: 'inst-1',
    installmentNumber: 3,
    amountDue: 1000,
    amountPaid: 0,
    penaltyAmount: 0,
    live: live as CollectionSheetItemLive | null,
  } as unknown as CollectionSheetItem;
}

describe('PaymentDialogComponent (P11 saldo vivo con mora)', () => {
  let component: PaymentDialogComponent;
  let create: jasmine.Spy;

  beforeEach(() => {
    create = jasmine.createSpy('create').and.returnValue(of({ warning: null }));
    TestBed.configureTestingModule({
      imports: [PaymentDialogComponent, NoopAnimationsModule],
      providers: [
        MessageService,
        { provide: PaymentsService, useValue: { create } },
      ],
    });
    component = TestBed.createComponent(
      PaymentDialogComponent,
    ).componentInstance;
  });

  it('usa el saldo vivo (con mora) y no el snapshot de la planilla', () => {
    const item = buildItem({
      amountDue: 1200,
      amountPaid: 100,
      penaltyAmount: 200,
      creditPendingBalance: 5000,
    });
    expect(component.availableBalance(item)).toBe(1100);
  });

  it('pagar el saldo vivo completo es pago total: sin nextVisitDate', () => {
    component.item = buildItem({
      amountDue: 1200,
      amountPaid: 0,
      penaltyAmount: 200,
      creditPendingBalance: 5000,
    });
    component.paymentCashAmount = 1200;
    expect(component.isPartialPayment()).toBeFalse();
    expect(component.paymentFormInvalid).toBeFalse();
    component.confirmPayment();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.calls.mostRecent().args[0].nextVisitDate).toBeUndefined();
  });

  it('pagar el snapshot cuando la mora subió es parcial y exige próxima visita', () => {
    component.item = buildItem({
      amountDue: 1200,
      amountPaid: 0,
      penaltyAmount: 200,
      creditPendingBalance: 5000,
    });
    component.paymentCashAmount = 1000;
    expect(component.isPartialPayment()).toBeTrue();
    expect(component.paymentFormInvalid).toBeTrue();
  });

  it('cuota sin mora: pagar el saldo completo sigue siendo total', () => {
    component.item = buildItem({
      amountDue: 1000,
      amountPaid: 0,
      penaltyAmount: 0,
      creditPendingBalance: 1000,
    });
    component.paymentCashAmount = 1000;
    expect(component.isPartialPayment()).toBeFalse();
  });

  it('planilla read-only (live=null) cae al snapshot', () => {
    expect(component.availableBalance(buildItem(null))).toBe(1000);
  });

  it('capa viva con montos null cae al snapshot campo por campo', () => {
    expect(
      component.availableBalance(
        buildItem({ amountDue: null, amountPaid: null }),
      ),
    ).toBe(1000);
  });
});
