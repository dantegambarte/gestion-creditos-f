import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { UserEditFormComponent } from './user-edit-form.component';
import { UsersService } from '../../users.service';
import { UserDetail } from '../../user.model';

describe('UserEditFormComponent payload', () => {
  let component: UserEditFormComponent;
  let usersSpy: jasmine.SpyObj<UsersService>;

  beforeEach(() => {
    usersSpy = jasmine.createSpyObj<UsersService>('UsersService', ['update']);
    usersSpy.update.and.returnValue(of({} as UserDetail));
    TestBed.configureTestingModule({
      providers: [{ provide: UsersService, useValue: usersSpy }, MessageService],
    });
    component = TestBed.runInInjectionContext(() => new UserEditFormComponent());
    component.user = {
      id: 'u1',
      fullName: 'Ana Gomez',
      dni: '12345678',
      email: 'ana@mail.com',
      address: 'Calle 1',
      role: 'SELLER',
    } as unknown as UserDetail;
    component.ngOnInit();
  });

  it('sends empty values when email and address are cleared', () => {
    component.editForm.patchValue({ email: '', address: '' });
    component.onSubmit();
    const payload = usersSpy.update.calls.mostRecent().args[1];
    expect(payload.email).toBe('');
    expect(payload.address).toBe('');
  });

  it('keeps sending filled values on a normal edit', () => {
    component.editForm.patchValue({ address: 'Calle 9' });
    component.onSubmit();
    const payload = usersSpy.update.calls.mostRecent().args[1];
    expect(payload.address).toBe('Calle 9');
    expect(payload.email).toBe('ana@mail.com');
  });
});
