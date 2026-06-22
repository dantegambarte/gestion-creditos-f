import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { UsersService } from './users.service';
import { environment } from '../../../../environments/environment';

const BASE = `${environment.apiBaseUrl}/users`;

const rawUser = {
  id: 'user-uuid-1',
  full_name: 'Ana García',
  dni: '87654321',
  email: 'ana@test.com',
  address: 'Calle Test 1',
  role: 'SELLER' as const,
  status: 'ACTIVE' as const,
  is_temp_password: false,
  failed_attempts: 0,
  locked_at: null,
  last_login_at: '2024-05-01T10:00:00.000Z',
  created_at: '2024-01-01T00:00:00.000Z',
};

const rawDetail = { ...rawUser, updated_at: '2024-06-01T00:00:00.000Z' };

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() sin filtros — no envía query params', (done) => {
    service.list().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].fullName).toBe('Ana García');
      expect(users[0].isTempPassword).toBe(false);
      done();
    });

    const req = http.expectOne(BASE);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ ok: true, message: 'ok', data: [rawUser] });
  });

  it('list() con role y status — envía ambos params', (done) => {
    service
      .list({ role: 'COLLECTOR', status: 'ACTIVE' })
      .subscribe(() => done());

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('role')).toBe('COLLECTOR');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.has('search')).toBeFalse();
    req.flush({ ok: true, message: 'ok', data: [rawUser] });
  });

  it('listCollectors() — llama list con roles=COLLECTOR,SELLER_COLLECTOR y status=ACTIVE', (done) => {
    service.listCollectors().subscribe((users) => {
      expect(users.length).toBe(1);
      done();
    });

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('roles')).toBe('COLLECTOR,SELLER_COLLECTOR');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.has('role')).toBeFalse();
    req.flush({ ok: true, message: 'ok', data: [rawUser] });
  });

  it('create() — mapea { user, tempPassword } correctamente', (done) => {
    service
      .create({ fullName: 'Pedro López', dni: '11223344', role: 'SELLER' })
      .subscribe((result) => {
        expect(result.tempPassword).toBe('TempABC123!');
        expect(result.user.fullName).toBe('Ana García');
        expect(result.user.isTempPassword).toBe(false);
        expect(result.user.updatedAt).toBe('2024-06-01T00:00:00.000Z');
        done();
      });

    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body['full_name']).toBe('Pedro López');
    expect(req.request.body['dni']).toBe('11223344');
    expect(req.request.body['role']).toBe('SELLER');
    req.flush({
      ok: true,
      message: 'ok',
      data: { user: rawDetail, tempPassword: 'TempABC123!' },
    });
  });

  it('update() con rol cambiado — envía snake_case en body', (done) => {
    service
      .update('user-uuid-1', { fullName: 'Ana Editada', role: 'COLLECTOR' })
      .subscribe((detail) => {
        expect(detail.fullName).toBe('Ana García');
        done();
      });

    const req = http.expectOne(`${BASE}/user-uuid-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body['full_name']).toBe('Ana Editada');
    expect(req.request.body['role']).toBe('COLLECTOR');
    req.flush({ ok: true, message: 'ok', data: rawDetail });
  });

  it('create() — error 409 por DNI se propaga con message del backend', (done) => {
    service
      .create({ fullName: 'Test', dni: '87654321', role: 'SELLER' })
      .subscribe({
        error: (err) => {
          expect(err.status).toBe(409);
          expect(err.message).toBe(
            'Ya existe un usuario registrado con ese DNI.',
          );
          done();
        },
      });

    const req = http.expectOne(BASE);
    req.flush(
      { ok: false, message: 'Ya existe un usuario registrado con ese DNI.' },
      { status: 409, statusText: 'Conflict' },
    );
  });

  it('resetPassword() — retorna { tempPassword } desde data', (done) => {
    service.resetPassword('user-uuid-1').subscribe((result) => {
      expect(result.tempPassword).toBe('Reset9999!');
      done();
    });

    const req = http.expectOne(`${BASE}/user-uuid-1/reset-password`);
    req.flush({
      ok: true,
      message: 'ok',
      data: { tempPassword: 'Reset9999!' },
    });
  });
});
