// La versión ESM que publica Leaflet 1.9 (`dist/leaflet-src.esm.js`) tiene los mismos tipos que `leaflet`
// (@types/leaflet). Se importa esa versión para que el *build* no avise por una dependencia CommonJS (HU-W2.3-01).
declare module 'leaflet/dist/leaflet-src.esm.js' {
  export * from 'leaflet';
}
