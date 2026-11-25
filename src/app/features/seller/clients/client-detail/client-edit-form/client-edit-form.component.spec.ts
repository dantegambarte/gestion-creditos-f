import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { ClientEditFormComponent } from './client-edit-form.component';
import { CustomersService } from '../../customers.service';
import { UsersService } from '../../../../admin/users/users.service';
import { CustomerDetail } from '../../../models/customer.model';

describe('ClientEditFormComponent payload', () => {
  let component: ClientEditFormComponent;
  let customersSpy: jasmine.SpyObj<CustomersService>;

  beforeEach(() => {
    customersSpy = jasmine.createSpyObj<CustomersService>('CustomersService', ['update']);
    customersSpy.update.and.returnValue(of({} as CustomerDetail));
    const usersSpy = jasmine.createSpyObj<UsersService>('UsersService', ['listCollectors']);
    usersSpy.listCollectors.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: CustomersService, useValue: customersSpy },
        { provide: UsersService, useValue: usersSpy },
        MessageService,
      ],
    });
    component = TestBed.runInInjectionContext(() => new ClientEditFormComponent());
    component.customer = {
      id: 'c1',
      fullName: 'Juan Perez',
      dni: '12345678',
      address: 'Calle 1',
      phone: '3811234567',
      email: 'juan@mail.com',
      collectorId: 'col-1',
    } as unknown as CustomerDetail;
    component.ngOnInit();
  });

  it('sends empty values when optional fields are cleared', () => {
    component.editForm.patchValue({
      address: '',
      phone: '',
      email: '',
      assignedCollectorId: null,
    });
    component.onSubmit();
    const payload = customersSpy.update.calls.mostRecent().args[1];
    expect(payload.address).toBe('');
    expect(payload.phone).toBe('');
    expect(payload.email).toBe('');
    expect(payload.assignedCollectorId).toBeNull();
  });

  it('keeps sending filled values on a normal edit', () => {
    component.editForm.patchValue({ address: 'Calle 2' });
    component.onSubmit();
    const payload = customersSpy.update.calls.mostRecent().args[1];
    expect(payload.address).toBe('Calle 2');
    expect(payload.email).toBe('juan@mail.com');
  });
});
