import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { Credit } from '../../models/credit.model';
import { CustomerDetail } from '../../models/customer.model';
import { CreditsService } from '../../operations/credits.service';
import { CustomersService } from '../customers.service';
import { ClientDetailComponent } from './client-detail.component';

describe('ClientDetailComponent (ficha ruteada de cliente)', () => {
  /**
   * Arma un crédito mínimo con el estado dado.
   * @param {string} id - id del crédito
   * @param {string} status - estado de backend
   */
  const credit = (id: string, status: string): Credit => ({ id, status }) as unknown as Credit;

  /**
   * Crea el componente con los créditos dados y ejecuta su carga inicial sin renderizar.
   * @param {Credit[]} credits - créditos que devuelve el backend
   */
  function setup(credits: Credit[]): ClientDetailComponent {
    TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '12345678' }) } },
        },
        {
          provide: CustomersService,
          useValue: {
            getById: () => of({ id: 'cust-001', fullName: 'Ana García' } as CustomerDetail),
          },
        },
        { provide: CreditsService, useValue: { list: () => of(credits) } },
        { provide: AuthServiceBase, useValue: { hasRole: () => true } },
      ],
    });
    const component = TestBed.createComponent(ClientDetailComponent).componentInstance;
    component.ngOnInit();
    return component;
  }

  it('no muestra ni cuenta los créditos REJECTED (#47)', () => {
    const component = setup([
      credit('c-active', 'ACTIVE'),
      credit('c-rejected', 'REJECTED'),
      credit('c-settled', 'SETTLED'),
    ]);

    expect(component.credits.map((c) => c.id)).toEqual(['c-active', 'c-settled']);
  });

  it('mantiene los créditos pendientes de aprobación', () => {
    const component = setup([credit('c-pending', 'PENDING_APPROVAL')]);

    expect(component.credits.map((c) => c.id)).toEqual(['c-pending']);
  });
});
