import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { APP_INITIALIZER } from '@angular/core';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { provideAuth } from './auth.provider';
import { AuthServiceBase } from './auth-service.base';
import { AuthService } from './auth.service';
import { MockAuthService } from './mock-auth.service';

describe('provideAuth', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideAuth(),
        { provide: APP_INITIALIZER, useValue: () => undefined, multi: true },
      ],
    });
  });

  it('registra AuthServiceBase con la implementación según environment.useMocks', () => {
    const auth = TestBed.inject(AuthServiceBase);
    const expected = environment.useMocks ? MockAuthService : AuthService;
    expect(auth instanceof expected).toBeTrue();
  });

  it('no expone el token legacy MockAuthService', () => {
    expect(TestBed.inject(MockAuthService, null, { optional: true })).toBeNull();
  });
});
