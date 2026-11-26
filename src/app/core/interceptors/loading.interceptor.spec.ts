import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoadingService } from '../services/loading.service';
import { loadingInterceptor } from './loading.interceptor';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });

  afterEach(() => httpMock.verify());

  it('muestra el spinner durante la request y lo oculta al responder', () => {
    http.get('/api/clients').subscribe();
    expect(loading.isLoading()).toBeTrue();

    httpMock.expectOne('/api/clients').flush([]);
    expect(loading.isLoading()).toBeFalse();
  });

  it('oculta el spinner también cuando la request falla', () => {
    http.get('/api/clients').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/clients').flush('x', { status: 500, statusText: 'Error' });

    expect(loading.isLoading()).toBeFalse();
  });

  it('mantiene el spinner hasta que terminan todas las requests concurrentes', () => {
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();

    httpMock.expectOne('/api/a').flush({});
    expect(loading.isLoading()).toBeTrue();
    httpMock.expectOne('/api/b').flush({});
    expect(loading.isLoading()).toBeFalse();
  });

  it('no activa el spinner para endpoints silenciosos de polling', () => {
    http.get('/api/cash-register/dashboard').subscribe();
    expect(loading.isLoading()).toBeFalse();

    httpMock.expectOne('/api/cash-register/dashboard').flush({});
  });
});
