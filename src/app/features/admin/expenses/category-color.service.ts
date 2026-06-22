import { Injectable } from '@angular/core';

/**
 * Asigna colores HSL únicos y deterministas a categorías de gasto,
 * garantizando contraste WCAG entre fondo y texto.
 */
@Injectable({ providedIn: 'root' })
export class CategoryColorService {
  private readonly cache = new Map<string, string>();

  /**
   * Devuelve el color de fondo HSL para una categoría.
   * @param categoryName nombre de la categoría
   */
  getColor(categoryName: string): string {
    if (!categoryName) return 'hsl(222 24% 46%)';
    const cached = this.cache.get(categoryName);
    if (cached) return cached;

    const existing = new Set(this.cache.values());
    const hue = this.nextFreeHue(this.hashToHue(categoryName), existing);
    const color = `hsl(${hue} 72% 54%)`;
    this.cache.set(categoryName, color);
    return color;
  }

  /**
   * Devuelve el color de texto con mejor contraste WCAG sobre el fondo de la categoría.
   * @param categoryName nombre de la categoría
   */
  getTextColor(categoryName: string): string {
    return this.getBestContrastTextColor(this.getColor(categoryName));
  }

  private hashToHue(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }

  private nextFreeHue(seed: number, existing: Set<string>): number {
    let hue = seed;
    for (let i = 0; i < 36; i++) {
      if (!existing.has(`hsl(${hue} 72% 54%)`)) return hue;
      hue = (hue + 47) % 360;
    }
    return seed;
  }

  private getBestContrastTextColor(hslColor: string): string {
    const rgb = this.hslToRgb(hslColor);
    if (!rgb) return '#ffffff';
    const white = { r: 255, g: 255, b: 255 };
    const dark = { r: 15, g: 23, b: 42 };
    return this.getContrastRatio(rgb, dark) >= this.getContrastRatio(rgb, white)
      ? '#0f172a'
      : '#ffffff';
  }

  private hslToRgb(
    hslColor: string,
  ): { r: number; g: number; b: number } | null {
    const match = hslColor.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/i);
    if (!match) return null;

    const h = Number(match[1]) / 360;
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;

    if (s === 0) {
      const gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hueToRgb = (t: number): number => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };

    return {
      r: Math.round(hueToRgb(h + 1 / 3) * 255),
      g: Math.round(hueToRgb(h) * 255),
      b: Math.round(hueToRgb(h - 1 / 3) * 255),
    };
  }

  private getContrastRatio(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ): number {
    const la = this.relativeLuminance(a);
    const lb = this.relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  private relativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const normalize = (v: number): number => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * normalize(rgb.r) +
      0.7152 * normalize(rgb.g) +
      0.0722 * normalize(rgb.b)
    );
  }
}
