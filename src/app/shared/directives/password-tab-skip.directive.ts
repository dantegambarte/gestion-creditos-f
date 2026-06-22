import { AfterViewInit, Directive, ElementRef } from '@angular/core';

/**
 * Removes eye-toggle buttons of p-password from the Tab order.
 * Apply on any container that holds one or more p-password elements.
 */
@Directive({ selector: '[appPasswordTabSkip]', standalone: true })
export class PasswordTabSkipDirective implements AfterViewInit {
  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.el.nativeElement
        .querySelectorAll('p-password .p-icon-wrapper')
        .forEach((node: HTMLElement) => node.setAttribute('tabindex', '-1'));
    });
  }
}
