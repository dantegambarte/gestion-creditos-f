import { TestBed } from '@angular/core/testing';
import { Message } from 'primeng/api';
import { DedupMessageService } from './dedup-message.service';

describe('DedupMessageService', () => {
  let service: DedupMessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DedupMessageService);
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('no apila el mismo toast (severity+summary+detail) mientras sigue vigente', () => {
    const messages: Message[] = [];
    service.messageObserver.subscribe((m) => messages.push(m as Message));

    service.add({ severity: 'warn', summary: 'Sesión expirada' });
    service.add({ severity: 'warn', summary: 'Sesión expirada' });
    service.add({ severity: 'warn', summary: 'Sesión expirada' });

    expect(messages.length).toBe(1);
  });

  it('permite un toast distinto (summary diferente) aunque llegue casi al mismo tiempo', () => {
    const messages: Message[] = [];
    service.messageObserver.subscribe((m) => messages.push(m as Message));

    service.add({ severity: 'warn', summary: 'Sesión expirada' });
    service.add({ severity: 'error', summary: 'Error interno del servidor' });

    expect(messages.length).toBe(2);
  });

  it('vuelve a mostrar el mismo toast si ya pasó la ventana de dedupe', () => {
    const messages: Message[] = [];
    service.messageObserver.subscribe((m) => messages.push(m as Message));

    service.add({ severity: 'warn', summary: 'Sesión expirada' });
    jasmine.clock().tick(3001);
    service.add({ severity: 'warn', summary: 'Sesión expirada' });

    expect(messages.length).toBe(2);
  });

  it('clear() resetea el tracking de dedupe', () => {
    const messages: Message[] = [];
    service.messageObserver.subscribe((m) => messages.push(m as Message));

    service.add({ severity: 'warn', summary: 'Sesión expirada' });
    service.clear();
    service.add({ severity: 'warn', summary: 'Sesión expirada' });

    expect(messages.length).toBe(2);
  });

  it('addAll aplica el mismo dedupe mensaje por mensaje', () => {
    const messages: Message[] = [];
    service.messageObserver.subscribe((m) => messages.push(m as Message));

    service.addAll([
      { severity: 'warn', summary: 'Sesión expirada' },
      { severity: 'warn', summary: 'Sesión expirada' },
    ]);

    expect(messages.length).toBe(1);
  });
});
