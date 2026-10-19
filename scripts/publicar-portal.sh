#!/usr/bin/env bash
# Publica el build de producción del portal en su bucket S3 y refresca CloudFront (T5).
#
# Uso: scripts/publicar-portal.sh <staging|production-demo>
#      scripts/publicar-portal.sh --help
#
# Antes: npm ci && npm run build -- --configuration production
#
# 1. Lee de SSM dónde está el sitio: /solventa/<ambiente>/web/bucket y /solventa/<ambiente>/web/distribution-id
#    (los publica la composición web del repositorio backend).
# 2. Exige dist/solventa-front-web/browser/index.html.
# 3. Sube los archivos con hash (*.js, *.css, media/*) con Cache-Control immutable de un año.
# 4. Sube index.html, favicon.ico, i18n/* y el resto de archivos públicos con Cache-Control no-cache.
# 5. Invalida /, /index.html, /favicon.ico e /i18n/* y espera a que termine.
# 6. Al final borra del bucket lo que ya no está en el build (sync --delete).
#
# Nunca toca config.json: lo escribe Terraform con la configuración del ambiente (URL del API, pasarela y Cognito).
# Usa las credenciales de AWS del entorno: el rol OIDC en el workflow cd-portal.yml (staging) o las de quien lo corre
# (production-demo, desde scripts/environment/up.sh del backend o el pipeline de main).
set -euo pipefail

uso() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  -h | --help) uso; exit 0 ;;
  staging | production-demo) AMBIENTE="$1" ;;
  *) echo "Ambiente desconocido: '${1:-}'. Usa staging o production-demo (ver --help)." >&2; exit 2 ;;
esac

REGION="us-east-2"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$RAIZ/dist/solventa-front-web/browser"
export AWS_PAGER=""
# En Git Bash (Windows) evita que /solventa/... se convierta en una ruta de Windows.
export MSYS_NO_PATHCONV=1

command -v aws >/dev/null 2>&1 || { echo "Falta la CLI de AWS (aws)." >&2; exit 1; }
[[ -f "$BUILD/index.html" ]] || {
  echo "No hay build en $BUILD: corre npm ci && npm run build -- --configuration production." >&2
  exit 1
}

parametro() { aws ssm get-parameter --region "$REGION" --name "/solventa/$AMBIENTE/web/$1" --query Parameter.Value --output text; }
BUCKET="$(parametro bucket)"
DISTRIBUCION="$(parametro distribution-id)"
[[ -n "$BUCKET" && -n "$DISTRIBUCION" ]] || { echo "SSM no tiene el sitio de $AMBIENTE (¿está aplicada la composición web?)." >&2; exit 1; }
echo "Publicando $AMBIENTE: s3://$BUCKET (distribución $DISTRIBUCION)"

INMUTABLE="public,max-age=31536000,immutable"

echo "== archivos con hash (immutable)"
aws s3 cp "$BUILD" "s3://$BUCKET/" --region "$REGION" --recursive --only-show-errors \
  --exclude "*" --include "*.js" --include "*.css" --include "media/*" \
  --cache-control "$INMUTABLE"

echo "== index.html, favicon.ico, i18n y demás archivos públicos (no-cache)"
aws s3 cp "$BUILD" "s3://$BUCKET/" --region "$REGION" --recursive --only-show-errors \
  --exclude "*.js" --exclude "*.css" --exclude "media/*" --exclude "config.json" \
  --cache-control "no-cache"

echo "== invalidación de CloudFront"
INVALIDACION="$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUCION" \
  --paths "/" "/index.html" "/favicon.ico" "/i18n/*" --query Invalidation.Id --output text)"
aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUCION" --id "$INVALIDACION"
echo "Invalidación $INVALIDACION completada"

echo "== limpieza de archivos que ya no están en el build (sin tocar config.json)"
aws s3 sync "$BUILD" "s3://$BUCKET/" --region "$REGION" --delete --size-only --only-show-errors --exclude "config.json"

ARCHIVOS="$(find "$BUILD" -type f | wc -l | tr -d ' ')"
RESUMEN="Portal publicado en $AMBIENTE: $ARCHIVOS archivos en s3://$BUCKET, invalidación $INVALIDACION completada; config.json intacto."
echo "$RESUMEN"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '### %s\n\n%s\n' "Publicación del portal ($AMBIENTE)" "$RESUMEN" >>"$GITHUB_STEP_SUMMARY"
fi
