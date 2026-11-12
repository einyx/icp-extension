#!/usr/bin/env bash
# Build the extension as an XPI - the package addons.mozilla.org signs.
#
# The XPI is a plain zip of the extension's own files. The native-messaging host is NOT
# part of it: an add-on cannot ship a native host, so the host is installed on the machine
# separately with host/install.sh.
#
# Works both in this repository (the extension files are at the top) and in the icp
# repository (they are in extension/).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/dist"
ADDON_ID=""

# The arguments: an output directory, and --id for the add-on id.
while [ $# -gt 0 ]; do
  case "$1" in
    --id) ADDON_ID="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    *) OUT="$1"; shift ;;
  esac
done

if [ -f "$HERE/manifest.json" ]; then
  EXT_DIR="$HERE"
elif [ -f "$HERE/extension/manifest.json" ]; then
  EXT_DIR="$HERE/extension"
else
  echo "no manifest.json found next to this script or in extension/" >&2
  exit 1
fi

NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"].lower().replace(" ", "-"))' "$EXT_DIR/manifest.json")"
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$EXT_DIR/manifest.json")"
XPI="$OUT/$NAME-$VERSION.xpi"

# An add-on id, if one is given: addons.mozilla.org wants the manifest's id to
# be the id of the add-on it is a version of. The package is built in a
# staging copy, so the repository's manifest is not touched.

mkdir -p "$OUT"
rm -f "$XPI"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$EXT_DIR"/manifest.json "$EXT_DIR"/background.js "$EXT_DIR"/content.js \
   "$EXT_DIR"/popup.html "$EXT_DIR"/popup.js "$STAGE/"
mkdir -p "$STAGE/icons"
cp "$EXT_DIR"/icons/icon-48.png "$EXT_DIR"/icons/icon.png "$STAGE/icons/"

if [ -n "$ADDON_ID" ]; then
  python3 - "$STAGE/manifest.json" "$ADDON_ID" <<'PY'
import json
import sys

path, addon_id = sys.argv[1], sys.argv[2]
with open(path) as f:
    manifest = json.load(f)
manifest.setdefault("browser_specific_settings", {}).setdefault("gecko", {})["id"] = addon_id
with open(path, "w") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
PY
  echo "the manifest's id is $ADDON_ID"
fi

# The extension's own files, and nothing else: no README, no host/, no repository.
cd "$STAGE"
zip -q -X "$XPI" manifest.json background.js content.js popup.html popup.js
zip -q -X "$XPI" icons/icon-48.png icons/icon.png

# The same package under a .zip name: addons.mozilla.org's upload form asks for
# a zip, and the two are the same file.
cp "$XPI" "${XPI%.xpi}.zip"

echo "built $XPI"
echo "built ${XPI%.xpi}.zip"
unzip -l "$XPI" | sed 's/^/  /'
