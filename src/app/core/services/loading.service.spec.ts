import { TestBed } from '@angular/core/testing';

import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('mantiene el loading activo hasta que finalicen todas las requests concurrentes', () => {
    service.show();
    service.show();

    expect(service.isLoading()).toBeTrue();

    service.hide();

    expect(service.isLoading()).toBeTrue();

    service.hide();

    expect(service.isLoading()).toBeFalse();
  });

  it('no deja el contador en negativo si hide se llama de más', () => {
    service.hide();

    expect(service.isLoading()).toBeFalse();
  });
});
