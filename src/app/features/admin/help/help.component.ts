import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HeaderService } from '../../../core/services/header.service';
import { HELP_SECTIONS, HELP_VERSION, HelpBlock } from './help-content';

type HelpSubBlock = Extract<HelpBlock, { kind: 'sub' }>;

/**
 * Sección de Ayuda (admin): renderiza el Manual de Usuario con un índice
 * navegable. Contenido estático (help-content.ts); no consulta backend.
 */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly header = inject(HeaderService);
  readonly sections = HELP_SECTIONS;
  readonly version = HELP_VERSION;

  /** Id de la sección cuyo submenú está desplegado (null = ninguna). */
  expandedId: string | null = null;
  /** Id (sección o subsección) actualmente visible en el contenido, para resaltarlo en el índice. */
  activeId: string | null = null;

  /** Mapa subId -> sectionId padre, para auto-desplegar el índice según se va leyendo. */
  private readonly parentOf = new Map<string, string>();
  private observer?: IntersectionObserver;
  /** Mientras hay un scroll programático en curso, el observer ignora lo que pasa "de paso". */
  private suppressObserver = false;
  private suppressTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    for (const s of HELP_SECTIONS) {
      for (const sub of this.subsOf(s)) {
        this.parentOf.set(sub.id, s.id);
      }
    }
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Ayuda' }]);
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (this.suppressObserver) {
          return;
        }
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) {
          this.setActive(visible[0].target.id.replace('help-', ''));
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    );
    document.querySelectorAll('[id^="help-"]').forEach((el) => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.suppressTimer);
  }

  /** Marca el id leído como activo y, si es una subsección, despliega su sección padre. */
  private setActive(id: string): void {
    this.activeId = id;
    const parent = this.parentOf.get(id);
    this.expandedId = parent ?? id;
  }

  /** Subsecciones (bloques tipo 'sub') de una sección, para listarlas en el índice. */
  subsOf(section: (typeof HELP_SECTIONS)[number]): { id: string; title: string }[] {
    return section.blocks
      .filter((b): b is HelpSubBlock => b.kind === 'sub')
      .map((b) => ({ id: b.id, title: b.title }));
  }

  /** Despliega o cierra el submenú flotante de una sección del índice. */
  toggleExpand(id: string, event: Event): void {
    event.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }

  /** Desplaza suavemente hasta la sección o subsección indicada del manual. */
  scrollTo(id: string): void {
    this.suppressObserver = true;
    clearTimeout(this.suppressTimer);
    this.setActive(id);
    document
      .getElementById('help-' + id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.suppressTimer = setTimeout(() => {
      this.suppressObserver = false;
    }, 700);
  }
}
