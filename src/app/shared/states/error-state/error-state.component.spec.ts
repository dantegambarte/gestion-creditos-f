import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  let component: ErrorStateComponent;
  let fixture: ComponentFixture<ErrorStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no muestra Reintentar por defecto', () => {
    expect(fixture.nativeElement.querySelector('[data-cy="error-state-retry"]')).toBeNull();
  });

  it('emite retry al pulsar Reintentar', () => {
    fixture.componentRef.setInput('showRetry', true);
    fixture.detectChanges();
    const spy = spyOn(component.retry, 'emit');
    const btn = fixture.nativeElement.querySelector(
      '[data-cy="error-state-retry"] button',
    ) as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
