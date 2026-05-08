import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductsNavComponent } from '../products-nav/products-nav.component';

@Component({
  selector: 'app-products-shell',
  standalone: true,
  imports: [RouterOutlet, ProductsNavComponent],
  template: `
    <app-products-nav />
    <router-outlet />
  `,
})
export class ProductsShellComponent {}
