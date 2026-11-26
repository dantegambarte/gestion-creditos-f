import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { DateService } from '../../../core/services/date.service';
import { HeaderService } from '../../../core/services/header.service';
import { CreditsService } from '../../seller/operations/credits.service';
import { InstallmentsService } from '../../seller/operations/installments.service';
import { CollectionsService } from '../collections.service';
import {
  CollectionSheetDetail,
  CollectionSheetItem,
  CollectionSheetItemLive,
} from '../models/collection.model';
import { CollectionSheetDetailComponent } from './collection-sheet-detail.component';

const TODAY = '2026-11-26';

/**
 * Construye una cuota de planilla mínima con valores por defecto operables.
 * @param overrides - campos a pisar en la cuota
 */
function item(overrides: Partial<CollectionSheetItem> = {}): CollectionSheetItem {
  return {
    orderNumber: 1,
    installmentId: 'i1',
    installmentNumber: 1,
    dueDate: TODAY,
    amountDue: 10000,
    amountPaid: 0,
    penaltyAmount: 0,
    installmentStatus: 'PENDING',
    managementStatus: 'PENDING',
    hasPendingPayment: false,
    customerName: 'Juan Pérez',
    customerDni: '30111222',
    customerPhone: null,
    customerAddress: null,
    collectionReference: '',
    live: null,
    ...overrides,
  } as CollectionSheetItem;
}

/**
 * Construye la capa viva de una cuota.
 * @param overrides - campos vivos a pisar
 */
function live(overrides: Partial<CollectionSheetItemLive> = {}): CollectionSheetItemLive {
  return {
    installmentStatus: null,
    amountDue: null,
    amountPaid: null,
    penaltyAmount: null,
    creditPendingBalance: null,
    hasPendingPayment: false,
    todayAttemptId: null,
    todayAttemptType: null,
    renewable: false,
    ...overrides,
  };
}

/**
 * Construye una cuota con un estado de gestión del día.
 * @param managementStatus - estado de gestión vivo
 * @param overrides - otros campos a pisar
 */
function managed(managementStatus: string, overrides: Partial<CollectionSheetItem> = {}): CollectionSheetItem {
  return item({ ...overrides, managementStatus } as Partial<CollectionSheetItem>);
}

describe('CollectionSheetDetailComponent', () => {
  let fixture: ComponentFixture<CollectionSheetDetailComponent>;
  let c: CollectionSheetDetailComponent;
  let sheet: CollectionSheetDetail;

  beforeEach(async () => {
    sheet = {
      sheetDate: TODAY,
      status: 'ACTIVE',
      items: [item({ orderNumber: 2, installmentId: 'b' }), item({ orderNumber: 1, installmentId: 'a' })],
    } as CollectionSheetDetail;

    await TestBed.configureTestingModule({
      imports: [CollectionSheetDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ sheetId: 's1' }) } } },
        { provide: CollectionsService, useValue: { getById: () => of(sheet) } },
        { provide: InstallmentsService, useValue: {} },
        { provide: CreditsService, useValue: {} },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']) },
        { provide: HeaderService, useValue: jasmine.createSpyObj('HeaderService', ['set', 'reset']) },
        { provide: MessageService, useValue: jasmine.createSpyObj('MessageService', ['add']) },
        { provide: DateService, useValue: { toLocalIso: () => TODAY } },
      ],
    })
      .overrideComponent(CollectionSheetDetailComponent, { set: { template: '', imports: [] } })
      .compileComponents();

    fixture = TestBed.createComponent(CollectionSheetDetailComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga la planilla ordenada por número de orden y selecciona la primera', () => {
    expect(c.items.map((i) => i.installmentId)).toEqual(['a', 'b']);
    expect(c.selectedItem?.installmentId).toBe('a');
  });

  describe('montos vivos', () => {
    it('usa la capa viva (con mora) y cae al snapshot cuando no hay live', () => {
      const withLive = item({ live: live({ amountDue: 12500, penaltyAmount: 2500, amountPaid: 3000 }) });

      expect(c.displayAmountDue(withLive)).toBe(12500);
      expect(c.displayCapital(withLive)).toBe(10000);
      expect(c.availableBalance(withLive)).toBe(9500);
      expect(c.displayAmountDue(item())).toBe(10000);
    });

    it('nunca devuelve saldo disponible negativo', () => {
      expect(c.availableBalance(item({ amountDue: 1000, amountPaid: 1500 }))).toBe(0);
    });
  });

  describe('permisos de gestión', () => {
    it('permite cobrar en planilla activa del día con cuota pendiente', () => {
      expect(c.canRegisterPayment(item())).toBeTrue();
    });

    it('una planilla de un día anterior queda read-only', () => {
      c.sheet = { ...sheet, sheetDate: '2026-11-25' };
      expect(c.isOperable(item())).toBeFalse();
      expect(c.canRegisterPayment(item())).toBeFalse();
    });

    it('no permite cobrar con cuota saldada, ya cobrada o con pre-carga pendiente', () => {
      expect(c.canRegisterPayment(item({ installmentStatus: 'PAID' }))).toBeFalse();
      expect(c.canRegisterPayment(managed('PAID'))).toBeFalse();
      expect(c.canRegisterPayment(item({ live: live({ hasPendingPayment: true }) }))).toBeFalse();
    });

    it('no permite cobrar en una planilla que no está activa', () => {
      c.sheet = { ...sheet, status: 'REGENERATED' };
      expect(c.canRegisterPayment(item())).toBeFalse();
    });

    it('no permite cobrar mientras la cuota se está procesando', () => {
      c.processingItemId = 'i1';
      expect(c.canRegisterPayment(item())).toBeFalse();
    });

    it('sigue permitiendo cobrar tras un intento del día pero bloquea otro intento', () => {
      const attempted = managed('NO_PAYMENT');
      expect(c.canRegisterPayment(attempted)).toBeTrue();
      expect(c.canRegisterAttempt(attempted)).toBeFalse();
      expect(c.canRegisterAttempt(item())).toBeTrue();
    });

    it('solo permite renovar préstamos marcados renovables por la capa viva', () => {
      expect(c.canRenew(item({ live: live({ renewable: true }) }))).toBeTrue();
      expect(c.canRenew(item({ live: live({ renewable: false }) }))).toBeFalse();
      expect(c.canRenew(item())).toBeFalse();
    });

    it('solo anula intentos NO_PAYMENT / NOT_FOUND del día, nunca cobros', () => {
      expect(c.canVoidTodayAttempt(item({ live: live({ todayAttemptId: 'x', todayAttemptType: 'NO_PAYMENT' }) }))).toBeTrue();
      expect(c.canVoidTodayAttempt(item({ live: live({ todayAttemptId: 'x', todayAttemptType: 'NOT_FOUND' }) }))).toBeTrue();
      expect(c.canVoidTodayAttempt(item({ live: live({ todayAttemptId: null, todayAttemptType: 'NO_PAYMENT' }) }))).toBeFalse();
      expect(c.canVoidTodayAttempt(item())).toBeFalse();
    });
  });

  describe('mora derivada de la fecha', () => {
    it('una cuota vencida antes de la fecha de la planilla está en mora', () => {
      expect(c.isOverdue(item({ dueDate: '2026-11-25' }))).toBeTrue();
      expect(c.isOverdue(item({ dueDate: TODAY }))).toBeFalse();
    });

    it('cuotas pagas o parciales (también por capa viva) no están en mora', () => {
      expect(c.isOverdue(item({ dueDate: '2026-11-01', installmentStatus: 'PARTIAL' }))).toBeFalse();
      expect(c.isOverdue(item({ dueDate: '2026-11-01', live: live({ installmentStatus: 'PAID' }) }))).toBeFalse();
    });
  });

  describe('tabs, contadores y búsqueda', () => {
    beforeEach(() => {
      c.items = [
        item({ installmentId: 'p', customerName: 'José Gómez' }),
        managed('PAID', { installmentId: 'm', customerName: 'Ana Ruiz' }),
        item({ installmentId: 'pp', customerName: 'Luis Sosa', live: live({ hasPendingPayment: true }) }),
      ];
    });

    it('separa por gestionar, gestionadas y con pre-carga pendiente', () => {
      expect(c.pendingCount()).toBe(2);
      expect(c.managedCount()).toBe(1);
      expect(c.pendingPaymentCount()).toBe(1);

      c.setTab('MANAGED');
      expect(c.filteredItems.map((i) => i.installmentId)).toEqual(['m']);
      c.setTab('PENDING_PAYMENT');
      expect(c.filteredItems.map((i) => i.installmentId)).toEqual(['pp']);
    });

    it('al cambiar de tab selecciona la primera visible si la seleccionada ya no se ve', () => {
      c.selectedItem = c.items[0];
      c.setTab('MANAGED');
      expect(c.selectedItem?.installmentId).toBe('m');
    });

    it('busca sin distinguir mayúsculas ni acentos', () => {
      c.searchTerm = 'JOSE gomez';
      expect(c.filteredItems.map((i) => i.installmentId)).toEqual(['p']);
      c.clearSearch();
      expect(c.filteredItems.length).toBe(2);
    });
  });
});
