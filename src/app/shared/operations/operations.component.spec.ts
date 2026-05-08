import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CreditsService } from '../../features/seller/operations/credits.service';
import { OperationsComponent } from './operations.component';

describe('OperationsComponent', () => {
  let component: OperationsComponent;
  let fixture: ComponentFixture<OperationsComponent>;

  const creditsServiceMock = {
    list: jasmine.createSpy('list').and.returnValue(
      of([
        {
          id: '1',
          type: 'SALE',
          totalAmount: 35000,
          installmentsCount: 12,
          paymentFrequency: 'MONTHLY',
          interestRate: null,
          status: 'PENDING_APPROVAL',
          createdAt: '2026-04-15T00:00:00.000Z',
          approvedAt: null,
          customerId: 'c1',
          customerName: 'Juan Pérez García',
          customerDni: '12345678',
          createdById: null,
          createdByName: null,
        },
        {
          id: '2',
          type: 'LOAN',
          totalAmount: 22000,
          installmentsCount: 8,
          paymentFrequency: 'MONTHLY',
          interestRate: null,
          status: 'ACTIVE',
          createdAt: '2026-04-13T00:00:00.000Z',
          approvedAt: null,
          customerId: 'c2',
          customerName: 'Carlos Ruiz',
          customerDni: '33444555',
          createdById: null,
          createdByName: null,
        },
      ]),
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationsComponent],
      providers: [
        provideRouter([]),
        { provide: CreditsService, useValue: creditsServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OperationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('carga operaciones reales desde credits service', () => {
    expect(creditsServiceMock.list).toHaveBeenCalled();
    expect(component.operations.length).toBe(2);
  });

  it('CR-07: filtra por estado "Activo"', () => {
    component.selectedStatus = 'ACTIVE';

    const result = component.filteredOperations;

    expect(result.length).toBe(1);
    expect(result[0].status).toBe('ACTIVE');
  });

  it('CR-08: filtra por cliente ignorando tildes', () => {
    component.searchTerm = 'Perez';

    const result = component.filteredOperations;

    expect(result.length).toBe(1);
    expect(result[0].customerName).toContain('Pérez');
  });

  it('combina filtro de estado y búsqueda de cliente', () => {
    component.selectedStatus = 'ACTIVE';
    component.searchTerm = 'ruiz';

    const result = component.filteredOperations;

    expect(result.length).toBe(1);
    expect(result[0].customerName).toContain('Carlos Ruiz');
    expect(result[0].status).toBe('ACTIVE');
  });
});
