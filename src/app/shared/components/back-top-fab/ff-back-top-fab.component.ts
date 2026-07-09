import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, AfterViewInit, inject } from '@angular/core';

@Component({
  selector: 'ff-back-top-fab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show) {
      <button
        type="button"
        class="ff-back-top-fab"
        [attr.data-cy]="dataCy"
        aria-label="Volver arriba"
        (click)="scrollToTop()"
      >
        <i class="pi pi-arrow-up"></i>
      </button>
    }
  `,
})
export class FfBackTopFabComponent implements AfterViewInit, OnDestroy {
  /** Cantidad actual de ítems en la lista. El botón solo aparece cuando supera minItems. */
  @Input() itemCount = 0;

  /** Umbral mínimo de ítems para habilitar el botón. */
  @Input() minItems = 5;

  /** Selector para tests e2e. */
  @Input() dataCy = 'back-top-action';

  /** Selector CSS del contenedor de scroll. Por defecto usa .ff-shell__main. */
  @Input() scrollContainerSelector = '.ff-shell__main';

  /** Distancia mínima de scroll antes de mostrar el botón. */
  @Input() scrollThreshold = 520;

  private readonly cdr = inject(ChangeDetectorRef);
  private scrolledPast = false;
  private scrollContainer: HTMLElement | Window | null = null;

  get show(): boolean {
    return this.itemCount > this.minItems && this.scrolledPast;
  }

  ngAfterViewInit(): void {
    const el = document.querySelector(this.scrollContainerSelector);
    this.scrollContainer = el instanceof HTMLElement ? el : window;
    this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
    this.handleScroll();
  }

  ngOnDestroy(): void {
    this.scrollContainer?.removeEventListener('scroll', this.handleScroll);
  }

  /**
   * Actualiza visibilidad según posición de scroll del contenedor activo.
   */
  private readonly handleScroll = (): void => {
    const top =
      this.scrollContainer instanceof Window
        ? window.scrollY
        : (this.scrollContainer as HTMLElement)?.scrollTop ?? 0;
    const past = top > this.scrollThreshold;
    if (past !== this.scrolledPast) {
      this.scrolledPast = past;
      this.cdr.markForCheck();
    }
  };

  /**
   * Hace scroll suave al inicio del contenedor principal y oculta el botón.
   */
  scrollToTop(): void {
    if (this.scrollContainer instanceof HTMLElement) {
      this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.scrolledPast = false;
    this.cdr.markForCheck();
  }
}
