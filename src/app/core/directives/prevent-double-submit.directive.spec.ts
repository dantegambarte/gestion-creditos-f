import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreventDoubleSubmitDirective } from './prevent-double-submit.directive';

@Component({
  imports: [PreventDoubleSubmitDirective],
  template: `<button appPreventDoubleSubmit>Enviar</button>`,
})
class TestHostComponent {}

describe('PreventDoubleSubmitDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let btn: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    btn = fixture.nativeElement.querySelector('button');
  });

  it('should create an instance', () => {
    expect(btn).toBeTruthy();
  });

  it('debería deshabilitar el botón al hacer clic', () => {
    btn.click();
    expect(btn.disabled).toBeTrue();
  });

  it('debería mostrar loadingLabel al hacer clic', () => {
    btn.click();
    expect(btn.innerText).toBe('Procesando...');
  });

  it('no debería reaccionar a clic si ya está deshabilitado', () => {
    btn.click();
    const textAfterFirst = btn.innerText;
    btn.click();
    expect(btn.innerText).toBe(textAfterFirst);
  });
});
