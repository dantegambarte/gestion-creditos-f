import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { HeaderService } from '../../../core/services/header.service';
import { HELP_SECTIONS, HELP_VERSION } from './help-content';

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
export class HelpComponent implements OnInit {
  private readonly header = inject(HeaderService);
  readonly sections = HELP_SECTIONS;
  readonly version = HELP_VERSION;

  ngOnInit(): void {
    this.header.set([{ label: 'Ayuda' }]);
  }

  /** Desplaza suavemente hasta la sección indicada del manual. */
  scrollTo(id: string): void {
    document
      .getElementById('help-' + id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
