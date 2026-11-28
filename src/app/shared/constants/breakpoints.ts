/**
 * Breakpoints compartidos del proyecto. `md` de Tailwind arranca en 768px, así que
 * el layout mobile es todo lo que queda por debajo (mismo valor que los @media SCSS).
 */
export const MOBILE_MAX_WIDTH_PX = 767.98;

/** Media query del layout mobile, para usar con `window.matchMedia`. */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;
