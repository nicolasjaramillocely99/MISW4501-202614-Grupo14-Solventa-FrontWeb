/**
 * jsdom no implementa `<dialog>.showModal()` ni `close()`. Este doble reproduce lo que importa para las pruebas: `open`, el
 * evento `close` y la cancelación con `Escape` (evento `cancel` que se puede frenar). El foco atrapado y el fondo inerte los
 * cubre la prueba E2E en Chromium. Uso: `simularDialogoNativo()` en `beforeAll` de la prueba.
 */
export function simularDialogoNativo(): void {
  const prototipo = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
  prototipo.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  prototipo.close = function (this: HTMLDialogElement) {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    }
  };
}

/** Lo que hace el navegador con `Escape` sobre un diálogo modal: un `cancel` cancelable y, si nadie lo frena, el cierre. */
export function pulsarEscapeEnDialogo(dialogo: HTMLDialogElement): void {
  const cancelacion = new Event('cancel', { cancelable: true });
  dialogo.dispatchEvent(cancelacion);
  if (!cancelacion.defaultPrevented) {
    dialogo.close();
  }
}
