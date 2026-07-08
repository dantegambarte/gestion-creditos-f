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
          totalToReturn: 52000,
          installmentsCount: 12,
          paymentFrequency: 'MONTHLY',
          interestRate: null,
          effectiveRate: null,
          paymentCondition: 'CASH',
          status: 'PENDING_APPROVAL',
          createdAt: '2026-04-15T00:00:00.000Z',
          approvedAt: null,
          customerId: 'c1',
          customerName: 'Juan Pérez García',
          customerDni: '12345678',
          createdById: null,
          createdByName: null,
          collectorName: null,
        },
        {
          id: '2',
          type: 'LOAN',
          totalAmount: 22000,
          totalToReturn: 57000,
          installmentsCount: 8,
          paymentFrequency: 'MONTHLY',
          interestRate: null,
          effectiveRate: 0.89,
          status: 'ACTIVE',
          createdAt: '2026-04-13T00:00:00.000Z',
          approvedAt: '2026-04-14T00:00:00.000Z',
          customerId: 'c2',
          customerName: 'Carlos Ruiz',
          customerDni: '33444555',
          createdById: null,
          createdByName: 'Vendedor Demo',
          collectorName: 'Cobrador Demo',
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

  it('CR-17: la tabla tiene paginador configurado — paginator=true rows=10', () => {
    const table = fixture.nativeElement.querySelector('p-table');
    expect(table.getAttribute('ng-reflect-paginator')).toBe('true');
    expect(table.getAttribute('ng-reflect-rows')).toBe('10');
  });

  it('muestra en mobile la misma información operativa clave que desktop', () => {
    const mobileCard: HTMLElement = fixture.nativeElement.querySelector(
      '[data-cy="operations-mobile-card"]',
    );
    const text = mobileCard.textContent ?? '';

    expect(text).toContain('Total');
    expect(text).toContain('52.000');
    expect(text).not.toContain('35.000');
    expect(text).toContain('Creación');
    expect(text).toContain('Aprobación');
    expect(text).toContain('Contado');
    expect(text).toContain('Sin cobrador');
  });

  it('muestra vendedor y cobrador completos en las cards mobile', () => {
    const mobileCards: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('[data-cy="operations-mobile-card"]');
    const text = mobileCards[1].textContent ?? '';

    expect(text).toContain('Vendedor Demo');
    expect(text).toContain('Cobrador Demo');
  });

  it('limpia la búsqueda desde el botón del input', () => {
    component.searchTerm = '33444555';
    fixture.detectChanges();

    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-cy="operations-search-clear"]',
    );
    clearButton.click();
    fixture.detectChanges();

    expect(component.searchTerm).toBe('');
    expect(
      fixture.nativeElement.querySelector('[data-cy="operations-search-clear"]'),
    ).toBeNull();
  });
});
