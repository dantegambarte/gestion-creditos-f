import { escapeHtml } from './escape-html.util';

describe('escapeHtml', () => {
  it('escapa etiquetas y atributos para que se muestren como texto', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(escapeHtml("<b>x</b> & 'y'")).toBe('&lt;b&gt;x&lt;/b&gt; &amp; &#39;y&#39;');
  });

  it('devuelve cadena vacía para null o undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('se renderiza como texto literal al insertarse como HTML', () => {
    const el = document.createElement('span');
    el.innerHTML = `¿Desactivar a <strong>${escapeHtml('<b>x</b>')}</strong>?`;
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toBe('¿Desactivar a <b>x</b>?');
  });
});
