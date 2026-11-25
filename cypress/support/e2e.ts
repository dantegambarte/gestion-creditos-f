import './commands';

/**
 * Guard global de modo real: si realAuthEnabled es false, los specs que usan
 * el backend real (detectados en cypress.config.ts) se saltean en lugar de
 * fallar o escribir en una base que no corresponde. Es un `before` raíz: corre
 * antes que los `before()` de cada suite, así tampoco se ejecutan sus hooks.
 */
before(function () {
  const realSpecs = (Cypress.env('realSpecs') as string[] | undefined) ?? [];
  const realAuthEnabled = String(Cypress.env('realAuthEnabled')) === 'true';
  const specPath = Cypress.spec.relative.split('\\').join('/');
  if (!realAuthEnabled && realSpecs.includes(specPath)) {
    this.skip();
  }
});
