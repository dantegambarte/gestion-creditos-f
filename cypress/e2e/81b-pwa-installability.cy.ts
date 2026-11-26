/**
 * SUITE: PWA — instalabilidad y App Shell.
 *
 * Cubre el contrato mínimo para que mobile browsers puedan ofrecer
 * "Agregar a pantalla de inicio" sin introducir caché de API.
 */

describe('PWA — Installability', () => {
  it('expone manifest, theme-color y viewport mobile bloqueado', () => {
    cy.visit('/login');

    cy.get('html').should('have.attr', 'lang', 'es');
    cy.title().should('eq', 'FinFlow');
    cy.get('link[rel="manifest"]')
      .should('have.attr', 'href')
      .and('eq', 'manifest.webmanifest');
    cy.get('meta[name="theme-color"]').should(
      'have.attr',
      'content',
      '#0b0d14',
    );
    cy.get('meta[name="viewport"]')
      .should('have.attr', 'content')
      .and('include', 'width=device-width')
      .and('include', 'initial-scale=1')
      .and('include', 'maximum-scale=1')
      .and('include', 'user-scalable=0')
      .and('include', 'viewport-fit=cover');
  });

  it('configura el manifest como app standalone FinFlow con iconos instalables', () => {
    cy.request('/manifest.webmanifest')
      .its('body')
      .then((manifest) => {
        expect(manifest).to.include({
          name: 'FinFlow',
          short_name: 'FinFlow',
          display: 'standalone',
          theme_color: '#0b0d14',
          background_color: '#0b0d14',
        });

        expect(manifest.icons).to.be.an('array').and.have.length.at.least(2);
        expect(manifest.icons).to.deep.include({
          src: 'icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable any',
        });
        expect(manifest.icons).to.deep.include({
          src: 'icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable any',
        });
      });
  });

  it('mantiene el Service Worker limitado al App Shell y assets estáticos', () => {
    cy.readFile('ngsw-config.json').then((config) => {
      expect(config.index).to.eq('/index.html');
      expect(config).to.not.have.property('dataGroups');

      const appGroup = config.assetGroups.find(
        (group: { name: string }) => group.name === 'app',
      );
      expect(appGroup).to.exist;
      expect(appGroup.installMode).to.eq('prefetch');
      expect(appGroup.resources.files).to.include.members([
        '/index.html',
        '/index.csr.html',
        '/manifest.webmanifest',
        '/*.css',
        '/*.js',
      ]);

      const staticGroup = config.assetGroups.find(
        (group: { name: string }) => group.name === 'static-assets',
      );
      expect(staticGroup).to.exist;
      expect(staticGroup.installMode).to.eq('prefetch');
      expect(staticGroup.updateMode).to.eq('prefetch');
      expect(staticGroup.resources.files).to.include('/icons/**');
    });
  });
});
