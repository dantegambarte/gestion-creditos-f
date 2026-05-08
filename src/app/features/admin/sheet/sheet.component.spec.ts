import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { HeaderService } from '../../../core/services/header.service';
import { UsersService } from '../users/users.service';
import { CollectionsService } from '../../collector/collections.service';
import { SheetComponent } from './sheet.component';

const mockCollector = { id: 'c1', fullName: 'Luis Cobrador', role: 'COLLECTOR', status: 'ACTIVE', email: 'luis@test.com' };

const mockDetail = {
  id: 'sheet1',
  sheetDate: '2026-04-25',
  filterUsed: 'OVERDUE' as const,
  createdAt: '2026-04-25T10:00:00Z',
  collectorName: 'Luis Cobrador',
  totalItems: 2,
  collectorId: 'c1',
  generatedByName: 'Admin',
  items: [
    {
      orderNumber: 1,
      plannedAmount: 1000,
      installmentId: 'i1',
      installmentNumber: 3,
      dueDate: '2026-04-20',
      amountDue: 1000,
      amountPaid: 0,
      penaltyAmount: 0,
      installmentStatus: 'OVERDUE' as const,
      creditId: 'cr1',
      creditType: 'SALE' as const,
      customerName: 'Juan Cliente',
      customerPhone: null,
      customerAddress: null,
    },
  ],
};

describe('SheetComponent (planillas)', () => {
  let component: SheetComponent;
  let fixture: ComponentFixture<SheetComponent>;
  let collectionsSpy: jasmine.SpyObj<CollectionsService>;
  let usersSpy: jasmine.SpyObj<UsersService>;
  let headerSpy: jasmine.SpyObj<HeaderService>;

  beforeEach(async () => {
    collectionsSpy = jasmine.createSpyObj('CollectionsService', ['list', 'getById', 'generate']);
    usersSpy = jasmine.createSpyObj('UsersService', ['listCollectors']);
    headerSpy = jasmine.createSpyObj('HeaderService', ['set', 'reset']);

    collectionsSpy.list.and.returnValue(of([]));
    usersSpy.listCollectors.and.returnValue(of([mockCollector] as any));

    await TestBed.configureTestingModule({
      imports: [SheetComponent],
      providers: [
        MessageService,
        { provide: CollectionsService, useValue: collectionsSpy },
        { provide: UsersService, useValue: usersSpy },
        { provide: HeaderService, useValue: headerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit calls listCollectors and CollectionsService.list', () => {
    expect(usersSpy.listCollectors).toHaveBeenCalled();
    expect(collectionsSpy.list).toHaveBeenCalled();
    expect(component.collectorOptions.length).toBe(1);
    expect(component.collectorOptions[0].label).toBe('Luis Cobrador');
  });

  it('generatePlanilla calls generate with mapped filter', () => {
    collectionsSpy.generate.and.returnValue(of(mockDetail));
    component.selectedCollectorId = 'c1';
    component.selectedFilter = 'OVERDUE';
    component.generatePlanilla();
    const [payload] = collectionsSpy.generate.calls.mostRecent().args;
    expect(payload.collectorId).toBe('c1');
    expect(payload.filter).toBe('OVERDUE');
    expect(component.results.length).toBe(1);
    expect(component.results[0].collectorName).toBe('Luis Cobrador');
  });

  it('generatePlanilla with 409 error shows toast warn', () => {
    const msgSpy = spyOn((component as any).msg, 'add');
    collectionsSpy.generate.and.returnValue(throwError(() => ({ status: 409, message: 'Sin cuotas' })));
    component.selectedCollectorId = 'c1';
    component.generatePlanilla();
    expect(msgSpy).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
    expect(component.results.length).toBe(0);
  });

  it('generatePlanilla evita reentrada cuando ya está generando', () => {
    collectionsSpy.generate.and.returnValue(NEVER);
    component.selectedCollectorId = 'c1';

    component.generatePlanilla();
    component.generatePlanilla();

    expect(collectionsSpy.generate).toHaveBeenCalledTimes(1);
  });

  it('generateForAll evita reentrada cuando ya está generando para todos', () => {
    component.generatingAll = true;

    component.generateForAll();

    expect(usersSpy.listCollectors).toHaveBeenCalledTimes(1);
  });
});
