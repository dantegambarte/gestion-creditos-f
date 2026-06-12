import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepClientComponent } from './step-client.component';

describe('StepClientComponent', () => {
  let component: StepClientComponent;
  let fixture: ComponentFixture<StepClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepClientComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepClientComponent);
    component = fixture.componentInstance;
    component.clients = [
      {
        id: '1',
        name: 'Juan Pérez',
        dni: '12345678',
        phone: '',
        email: '',
        status: 'ACTIVE',
        previousCredits: 0,
        delinquency: 'sin mora',
        paymentCapacity: 0,
      },
      {
        id: '2',
        name: 'Maria Gomez',
        dni: '87654321',
        phone: '',
        email: '',
        status: 'ACTIVE',
        previousCredits: 0,
        delinquency: 'sin mora',
        paymentCapacity: 0,
      },
    ];
    fixture.detectChanges();
  });

  it('filtra clientes por nombre ignorando tildes', () => {
    component.searchText = 'Perez';

    expect(component.filteredClients).toEqual([component.clients[0]]);
  });

  it('filtra clientes por DNI', () => {
    component.searchText = '8765';

    expect(component.filteredClients).toEqual([component.clients[1]]);
  });

  it('muestra el resumen enriquecido de créditos del cliente seleccionado — CR-27', () => {
    component.selectedClientId = '1';
    component.selectedClientSummary = {
      ...component.clients[0],
      previousCredits: 2,
      paidInstallments: 4,
      pendingInstallments: 3,
      overdueInstallments: 1,
      creditsSummary: [
        {
          id: 'credit-1',
          type: 'SALE',
          status: 'ACTIVE',
          totalAmount: 100000,
          balance: 60000,
          installmentsCount: 6,
          paidInstallments: 2,
          pendingInstallments: 3,
          overdueInstallments: 1,
        },
      ],
    } as any;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Créditos activos: 2');
    expect(component.selectedClient?.creditsSummary?.length).toBe(1);
    expect(component.selectedClient?.overdueInstallments).toBe(1);
  });
});
