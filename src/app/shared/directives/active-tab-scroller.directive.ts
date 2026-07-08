import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';

const DEFAULT_ACTIVE_SELECTOR = [
  '.ff-tab--active',
  '.products-nav__tab--active',
  '.sheet-tab--active',
  '[aria-selected="true"]',
].join(',');

/**
 * Mantiene visible y centrada la opción activa dentro de navegaciones horizontales.
 * Sirve para tabs mobile con scroll táctil nativo, sin introducir un carrusel real.
 */
@Directive({ selector: '[appActiveTabScroller]', standalone: true })
export class ActiveTabScrollerDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private mutationObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private activeSelector = DEFAULT_ACTIVE_SELECTOR;

  /**
   * Permite sobrescribir el selector activo; si no se informa usa los patrones conocidos.
   */
  @Input()
  set appActiveTabScroller(selector: string | null | undefined) {
    this.activeSelector = selector?.trim() || DEFAULT_ACTIVE_SELECTOR;
  }

  /**
   * Inicializa observadores para reaccionar a cambios de tab activo, contenido o tamaño.
   */
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observeMutations();
      this.observeResize();
      this.scheduleCenterActiveTab('auto');
    });
  }

  /**
   * Libera observadores y animaciones pendientes al destruir la directiva.
   */
  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
  }

  /**
   * Re-centra el tab activo después de una interacción directa del usuario.
   */
  @HostListener('click')
  onClick(): void {
    this.scheduleCenterActiveTab('smooth');
  }

  /**
   * Observa cambios de clase/ruta que puedan activar una pestaña distinta.
   */
  private observeMutations(): void {
    if (typeof MutationObserver === 'undefined') return;

    this.mutationObserver = new MutationObserver(() => {
      this.scheduleCenterActiveTab('auto');
    });
    this.mutationObserver.observe(this.el.nativeElement, {
      attributes: true,
      attributeFilter: ['class', 'aria-selected'],
      childList: true,
      subtree: true,
    });
  }

  /**
   * Observa cambios de ancho para mantener el activo visible al rotar o redimensionar.
   */
  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleCenterActiveTab('auto');
    });
    this.resizeObserver.observe(this.el.nativeElement);
  }

  /**
   * Programa el centrado para ejecutarlo cuando Angular ya aplicó las clases activas.
   * @param {ScrollBehavior} behavior - Tipo de desplazamiento esperado.
   */
  private scheduleCenterActiveTab(behavior: ScrollBehavior): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);

    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      this.centerActiveTab(behavior);
    });
  }

  /**
   * Calcula el scrollLeft necesario para centrar la opción activa sin salir del rango.
   * @param {ScrollBehavior} behavior - Tipo de desplazamiento esperado.
   */
  private centerActiveTab(behavior: ScrollBehavior): void {
    const host = this.el.nativeElement;
    const active = host.querySelector<HTMLElement>(this.activeSelector);
    if (!active || host.scrollWidth <= host.clientWidth) return;

    const activeCenter = active.offsetLeft + active.offsetWidth / 2;
    const target = activeCenter - host.clientWidth / 2;
    const maxScroll = host.scrollWidth - host.clientWidth;

    host.scrollTo({
      left: Math.max(0, Math.min(target, maxScroll)),
      behavior,
    });
  }
}
