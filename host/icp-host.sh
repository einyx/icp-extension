#!/usr/bin/env bash
# Launcher for the native-messaging host. The browser execs this with the extension's stdio.
#
# The host is the Rust client (`icp-host`), which speaks the same protocol over the
# same encrypted vault.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The master key of the vault lives in the GNOME keyring, which is reached over the session
# bus. A browser spawns this host without DBUS_SESSION_BUS_ADDRESS in its environment, so the
# keyring would be unreachable and the vault would decrypt with a different key - showing an
# empty password list. Point at the session bus explicitly when it is missing.
if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
  RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  for bus in "$RUNTIME_DIR/bus" "/run/user/$(id -u)/bus"; do
    if [ -S "$bus" ]; then
      export DBUS_SESSION_BUS_ADDRESS="unix:path=$bus"
      break
    fi
  done
fi

# The anisette server the client talks to. The browser's environment does not have the
# user's shell settings, so the usual local default is assumed.
export ICP_ANISETTE_URL="${ICP_ANISETTE_URL:-http://127.0.0.1:6969}"

# The host binary: an installed one first, then the one in a checkout.
HOST=""
for candidate in \
    "$HOME/.local/bin/icp-host" \
    "$REPO/../../apple-passwords/target/release/icp-host" \
    "$REPO/target/release/icp-host" \
    "$REPO/target/debug/icp-host"; do
  if [ -x "$candidate" ]; then
    HOST="$candidate"
    break
  fi
done

if [ -z "$HOST" ]; then
  echo "the icp-host binary was not found - build it with: cargo build --release" >&2
  exit 1
fi

exec "$HOST"
