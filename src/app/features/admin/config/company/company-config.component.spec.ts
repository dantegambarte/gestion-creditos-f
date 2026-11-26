import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { CompanyConfigComponent } from './company-config.component';

describe('CompanyConfigComponent', () => {
  it('bloquea el guardado y avisa en vez de descartar cambios en silencio', () => {
    const msg = jasmine.createSpyObj('MessageService', ['add']);
    TestBed.configureTestingModule({
      imports: [CompanyConfigComponent],
      providers: [{ provide: MessageService, useValue: msg }],
    });
    const fixture = TestBed.createComponent(CompanyConfigComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-cy="company-config-unavailable"]')).not.toBeNull();
    const btn = el.querySelector('[data-cy="company-config-save"] button') as HTMLButtonElement;
    expect(btn.disabled).toBeTrue();
    fixture.componentInstance.save();
    expect(msg.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
  });
});
