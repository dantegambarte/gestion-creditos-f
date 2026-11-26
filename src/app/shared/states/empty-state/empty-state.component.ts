import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  imports: [],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  @Input() message = 'No se encontraron resultados.';
}
