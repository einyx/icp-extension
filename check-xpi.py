"""Sanity-check the extension package the way addons.mozilla.org does.

AMO rejects a build that is missing a file the manifest refers to, that has no
gecko id, or that does not declare its data collection (Firefox 140+). This
checks those things offline, so a submission does not bounce.
"""

import json
import sys
import zipfile
from pathlib import Path

XPI = Path(sys.argv[1]) if len(sys.argv) > 1 else None

problems: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        problems.append(message)


with zipfile.ZipFile(XPI) as zf:
    names = set(zf.namelist())
    manifest = json.loads(zf.read("manifest.json"))

check("manifest.json" in names, "manifest.json is missing")
check(manifest.get("manifest_version") == 3, "manifest_version must be 3")
for key in ("name", "version", "description"):
    check(bool(manifest.get(key)), f"{key} is missing")
check(manifest.get("version", "").count(".") == 2, "version must be major.minor.patch")

gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
check(bool(gecko.get("id")), "browser_specific_settings.gecko.id is missing")
check("data_collection_permissions" in gecko,
      "browser_specific_settings.gecko.data_collection_permissions is missing "
      "(required by Firefox 140+)")

# Every file the manifest refers to must be in the package.
referenced = set()
for script in manifest.get("content_scripts", []):
    referenced.update(script.get("js", []))
    referenced.update(script.get("css", []))
background = manifest.get("background", {})
referenced.update(background.get("scripts", []))
if background.get("service_worker"):
    referenced.add(background["service_worker"])
if manifest.get("action", {}).get("default_popup"):
    referenced.add(manifest["action"]["default_popup"])
for missing in sorted(referenced - names):
    problems.append(f"{missing} is referenced by the manifest but not in the package")

check(not any(n.startswith("host/") or n in ("README.md", "LICENSE.md") for n in names),
      "the package must contain the extension only")

# Nothing that should not be in a package.
for forbidden in (".env", "id_rsa", "master.key", "vault.enc", "session.enc"):
    check(forbidden not in names, f"{forbidden} must not be in the package")

print(f"package: {XPI}")
print(f"  files    : {sorted(names)}")
print(f"  version  : {manifest.get('version')}")
print(f"  gecko id : {gecko.get('id')}")
print(f"  data     : {gecko.get('data_collection_permissions')}")
print(f"  perms    : {manifest.get('permissions')} + hosts {manifest.get('host_permissions')}")

if problems:
    print("\nPROBLEMS:")
    for p in problems:
        print(f"  - {p}")
    sys.exit(1)
print("\nOK - ready to submit")
