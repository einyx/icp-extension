# iCloud Passwords - the browser extension for [Apple Passwords](https://github.com/einyx/apple-passwords)

An iCloud Keychain autofill extension for Linux. It talks to the `icp` client
through a native-messaging host and fills your logins into the page, the way the
Passwords app does on a Mac or iPhone. Your one-time codes are generated on the
spot, never read from a stored copy.

It also **writes**: a login you make on a site can be recorded in your real
iCloud Keychain, and a password you change can be updated in place - so it
reaches your other Apple devices. Strong password suggestions come from the
client too.

The client it talks to is [Apple Passwords](https://github.com/einyx/apple-passwords),
the native iCloud Keychain app for Linux. This repository holds the extension
on its own, so it can be installed, versioned and shared on its own. MIT
licensed, like the project it comes from.

## How it works

```
browser page  <-- content script -->  extension  <-- native messaging -->  icp
                                                                  reads the local vault
```

`icp` decrypts your keychain into `~/.config/icp/vault.enc` (libsodium secret
box, key held in the GNOME keyring). The native host answers these requests:

| Request | Answer |
| --- | --- |
| `{"cmd":"ping"}` | `{"ok":true,"count":516}` - how many logins are stored |
| `{"cmd":"match","domain":"..."}` | the logins for that domain, with a live one-time code |
| `{"cmd":"totp","domain":"...","username":"..."}` | a freshly generated one-time code |
| `{"cmd":"save","domain":...,"username":...,"password":...}` | records a new login in the keychain |
| `{"cmd":"update","record":...,"password":...}` | changes a password already in the keychain |
| `{"cmd":"delete","record":...}` | removes a login from the keychain |
| `{"cmd":"generate","count":3}` | strong password suggestions |

The password is read from the page **only** when the user presses the button in
the popup, and it goes straight to the keychain - the extension never stores
it. A login that is already in the keychain is updated rather than added twice,
and the site is the tab's own host, never one the page claims.

A credential's one-time-code secret never crosses this protocol: `match`
carries the code generated at request time, and `totp` re-generates it when
the browser's copy has rolled over.

## Install

### Firefox

Firefox only installs signed extensions. Unsigned ones need the ESR-only
policy - put this in `~/.mozilla/distribution/policies.json` (or
`/etc/firefox/policies/policies.json`):

```json
{
  "policies": {
    "Preferences": {
      "xpinstall.signatures.required": false
    }
  }
}
```

Then either load it temporarily (`about:debugging` -> *This Firefox* -> *Load
Temporary Add-on* -> `manifest.json`; Firefox drops it on restart), or install
it permanently by copying this repository's files into the profile:

```bash
cp -r . ~/.mozilla/firefox/<profile>/extensions/icp-linux@local/
```

A sideloaded extension is disabled by default, so add this to the profile's
`user.js` as well:

```js
user_pref("extensions.autoDisableScopes", 0);
```

Then register the native host:

```bash
host/install.sh
```

### Chrome, Chromium, Helium, Brave

Load this repository unpacked (`chrome://extensions` -> *Developer mode* ->
*Load unpacked*), then register the native host with the extension id it
shows:

```bash
host/install.sh <EXTENSION_ID>
```

## Publish to addons.mozilla.org

Yes - this extension can be published on AMO (the Firefox Marketplace). It is
MIT licensed and its source is public, which is what AMO requires.

### 1. The package

```bash
./build-xpi.sh          # -> dist/apple-passwords-<version>.xpi and .zip
python3 check-xpi.py dist/apple-passwords-<version>.xpi
```

The XPI is the extension's own files and nothing else: an add-on cannot ship a
native host, so the host is installed on the machine separately with
`host/install.sh`. The `.zip` is the same package under the name addons.mozilla.org's
upload form asks for - the two files are identical.

### 2. The signature

AMO signs the package. The quickest way is `web-ext`, which uploads it and
brings the signed add-on back:

```bash
export AMO_API_KEY=...      AMO_API_SECRET=...    # Developer Settings -> API keys
export AMO_USER=...        AMO_PASSWORD=...
./sign.sh                  # -> dist/apple-passwords-<version>.signed.xpi
```

`sign.sh` lints the package with the same linter AMO uses first, so a
submission that would bounce does not.

Or, without an API key: <https://addons.mozilla.org/developers/> -> *Submit a
New Add-on* -> *On your own* (unlisted). Unlisted is the right first step: the
add-on gets signed and installable from its AMO URL without waiting for a
review. Listing it later only adds the store entry.

AMO asks for a source-code URL and a license - use this repository and the MIT
license in `LICENSE.md`.

#### The first upload, and the ones after it

The first upload *creates* the add-on, and the id in the manifest becomes its id
on AMO. The id in the repository's manifest (`icp-linux@local`) is the one a
sideloaded copy has; the package for AMO is built with the id the add-on has
there:

```bash
./build-xpi.sh --id "icloud-passwords@einyx.github.io"
``` A second "Submit a New Add-on" with
the same id fails with **Duplicate add-on ID found** - the add-on is already
there. From then on the upload goes to the add-on's own page:

> *Your add-ons* -> **iCloud Passwords** -> *Submit a new version* -> the zip.

The version has to be higher than the one AMO has, so the manifest's version
goes up with each release.

AMO wants the manifest's id to be the id of the add-on it is a version of, so
the package is built with that id. The repository's manifest is not touched by
that: the package is built in a staging copy.

### 3. The native host

AMO gives the signed add-on its own gecko id. Register the native host with
that id, so the host only talks to the add-on you installed:

```bash
host/install.sh "" "<AMO_ADDON_ID>"
```

The add-on id is in its AMO URL: `something@your-domain`. Several ids can be
given, separated by commas, so the sideloaded copy keeps working as well:

```bash
host/install.sh "" "icp-linux@local,<AMO_ADDON_ID>"
```

### 4. Installing it

In Firefox: `about:addons` -> gear -> *Install Add-on From URL*, and paste the
AMO URL. A signed add-on needs neither `xpinstall.signatures.required` nor
`extensions.autoDisableScopes`, and it updates itself.

## Security notes

* A credential's one-time-code secret never crosses the native-messaging
  protocol - only a code generated at that moment does.
* The native host answers a `match` request only for the domain of the page
  that asked. Sub-domains match with a dotted boundary, so `notexample.com`
  never matches `example.com`. Entries that carry only a saved name (no host)
  match only when that name is the registrable label of the page, so
  `cloudflare.attacker.net` cannot claim a "Cloudflare" entry.
* The password itself is never put into the page's DOM - it is only written
  into the form field when the user picks it.
* Filling requires a real user gesture: a synthetic event dispatched by the
  page is ignored.

## Requirements

* `icp` installed and signed in (`icp login`), so that the local vault exists
* the `icp-host` binary - the launcher looks for it in `~/.local/bin`, then in
  a checkout of the app's repository

## Notes

* The native host is spawned by the browser, which does not pass
  `DBUS_SESSION_BUS_ADDRESS` on. The launcher points at the session bus
  itself, because the vault's master key lives in the GNOME keyring and is
  otherwise unreachable - which would show an empty password list.
* The extension writes to the keychain only when the user asks it to: the
  button in the popup records a login, or changes the password of one that is
  already there.
