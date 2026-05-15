import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { UserCreateComponent } from './user-create.component';
import { UsersService } from '../users.service';
import { HeaderService } from '../../../../core/services/header.service';

describe('UserCreateComponent — US-03 validaciones de formulario', () => {
  let component: UserCreateComponent;
  let fixture: ComponentFixture<UserCreateComponent>;

  beforeEach(async () => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const usersServiceSpy = jasmine.createSpyObj('UsersService', ['create']);
    const headerServiceSpy = jasmine.createSpyObj('HeaderService', ['set']);

    await TestBed.configureTestingModule({
      imports: [UserCreateComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: UsersService, useValue: usersServiceSpy },
        { provide: HeaderService, useValue: headerServiceSpy },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('fullName validator (US-03)', () => {
    it('acepta nombre solo con letras', () => {
      component.form.get('fullName')!.setValue('Carlos González');
      expect(component.form.get('fullName')!.valid).toBeTrue();
    });

    it('rechaza nombre con símbolos', () => {
      component.form.get('fullName')!.setValue('Carlos@#$');
      expect(component.form.get('fullName')!.invalid).toBeTrue();
      expect(component.form.get('fullName')!.errors?.['pattern']).toBeTruthy();
    });

    it('rechaza nombre con números', () => {
      component.form.get('fullName')!.setValue('Carlos123');
      expect(component.form.get('fullName')!.invalid).toBeTrue();
    });

    it('getError muestra mensaje descriptivo para pattern en fullName', () => {
      component.form.get('fullName')!.setValue('Test@#!');
      component.form.get('fullName')!.markAsDirty();
      const msg = component.getError('fullName');
      expect(msg).toContain('letras');
    });
  });

  describe('dni validator (US-03)', () => {
    it('acepta DNI de 7 dígitos', () => {
      component.form.get('dni')!.setValue('1234567');
      expect(component.form.get('dni')!.valid).toBeTrue();
    });

    it('acepta DNI de 8 dígitos', () => {
      component.form.get('dni')!.setValue('12345678');
      expect(component.form.get('dni')!.valid).toBeTrue();
    });

    it('rechaza DNI con letras', () => {
      component.form.get('dni')!.setValue('ABCD1234');
      expect(component.form.get('dni')!.invalid).toBeTrue();
    });

    it('rechaza DNI de 6 dígitos', () => {
      component.form.get('dni')!.setValue('123456');
      expect(component.form.get('dni')!.invalid).toBeTrue();
    });

    it('rechaza DNI de 9 dígitos', () => {
      component.form.get('dni')!.setValue('123456789');
      expect(component.form.get('dni')!.invalid).toBeTrue();
    });

    it('getError muestra mensaje descriptivo para pattern en dni', () => {
      component.form.get('dni')!.setValue('abc');
      component.form.get('dni')!.markAsDirty();
      const msg = component.getError('dni');
      expect(msg).toContain('dígitos');
    });
  });
});
