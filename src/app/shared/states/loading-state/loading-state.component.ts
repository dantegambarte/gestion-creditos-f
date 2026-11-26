import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  imports: [],
  templateUrl: './loading-state.component.html',
})
export class LoadingStateComponent {
  @Input() message = 'Cargando…';
}
