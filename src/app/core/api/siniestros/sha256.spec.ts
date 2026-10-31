import { calcularSha256 } from './sha256';

describe('calcularSha256', () => {
  it('devuelve el resumen SHA-256 en minúsculas y hexadecimal', async () => {
    const resumen = await calcularSha256(new File(['abc'], 'a.txt'));

    expect(resumen).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('resume el archivo vacío', async () => {
    expect(await calcularSha256(new File([], 'vacio.txt'))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
