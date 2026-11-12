#!/usr/bin/env bash
# Upload the extension to addons.mozilla.org and get it signed.
#
# The signed add-on is what Firefox installs: an unsigned one needs the
# ESR-only policy, and a signed one updates itself.
#
# Needs an API key from addons.mozilla.org -> Developer Settings -> API keys
# (https://addons.mozilla.org/developers/addon/<id>/settings), and the
# credentials of the account that owns the add-on:
#
#   export AMO_API_KEY=...      AMO_API_SECRET=...
#   export AMO_USER=...        AMO_PASSWORD=...
#
# Then: ./sign.sh
#
# The signed package lands in dist/, and the add-on's id is printed - register
# the native host with it (host/install.sh "" "<that id>"), so the host only
# ever answers the add-on you installed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/dist"
STAGE="$OUT/staging"

if [ -f "$HERE/manifest.json" ]; then
  EXT_DIR="$HERE"
elif [ -f "$HERE/extension/manifest.json" ]; then
  EXT_DIR="$HERE/extension"
else
  echo "no manifest.json found next to this script or in extension/" >&2
  exit 1
fi

for var in AMO_API_KEY AMO_API_SECRET AMO_USER AMO_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "$var is not set - see the comments at the top of this script." >&2
    exit 1
  fi
done

mkdir -p "$OUT"

# Only the extension's own files go into the package: the repository holds a
# README, the host and the scripts, and an add-on must not carry those.
rm -rf "$STAGE"
mkdir -p "$STAGE"
for f in manifest.json background.js content.js popup.html popup.js; do
  cp "$EXT_DIR/$f" "$STAGE/$f"
done
mkdir -p "$STAGE/icons"
cp "$EXT_DIR"/icons/icon-48.png "$EXT_DIR"/icons/icon.png "$STAGE/icons/"

# lint first: web-ext runs the same linter addons.mozilla.org does.
npx --yes web-ext lint --source-dir "$STAGE"

# --channel=unlisted: the add-on is signed and installable from its own URL,
# without waiting for a review. It can be listed later.
npx --yes web-ext sign \
  --source-dir "$STAGE" \
  --api-key "$AMO_API_KEY" \
  --api-secret "$AMO_API_SECRET" \
  --amo-user "$AMO_USER" \
  --amo-password "$AMO_PASSWORD" \
  --channel=unlisted \
  --output-dir "$OUT"

echo
echo "The signed add-on is in $OUT. Install it from the URL addons.mozilla.org printed:"
echo "  about:addons -> gear -> Install Add-on From URL"
