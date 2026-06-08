import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';

import { CustomersService } from '../../../features/seller/clients/customers.service';
import { ClientCreateDialogComponent } from './client-create-dialog.component';

describe('ClientCreateDialogComponent', () => {
  let component: ClientCreateDialogComponent;
  let fixture: ComponentFixture<ClientCreateDialogComponent>;
  let customersServiceSpy: jasmine.SpyObj<CustomersService>;

  beforeEach(async () => {
    customersServiceSpy = jasmine.createSpyObj('CustomersService', ['create']);

    await TestBed.configureTestingModule({
      imports: [ClientCreateDialogComponent, NoopAnimationsModule],
      providers: [
        MessageService,
        { provide: CustomersService, useValue: customersServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientCreateDialogComponent);
    component = fixture.componentInstance;
    component.visible = true;
    component.collectorOptions = [{ label: 'Juan Cobrador', value: 'col-001' }];
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('CL-18 — no permite crear cliente si falta cobrador asignado', () => {
    component.form.patchValue({
      nombres: 'Ana',
      apellidos: 'Garcia',
      dni: '12345678',
      telefonoPrincipal: '3811234567',
      email: 'ana@test.com',
      direccion: 'Calle 123',
      assignedCollectorId: '',
    });

    expect(component.form.valid).toBeFalse();
    expect(
      component.form.get('assignedCollectorId')?.hasError('required'),
    ).toBeTrue();

    component.createClient();

    expect(customersServiceSpy.create).not.toHaveBeenCalled();
  });
});
