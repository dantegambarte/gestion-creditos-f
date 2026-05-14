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
});
