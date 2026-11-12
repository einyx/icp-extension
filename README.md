# Apple Passwords - browser extension for [icp](https://github.com/Sank6/iCloud-Keychain-for-Linux)

An iCloud Keychain autofill extension for Linux. It talks to the `icp` client
through a native-messaging host and fills your logins into the page, the way the
Passwords app does on a Mac or iPhone. Your one-time codes are generated on the
spot, never read from a stored copy.

It also **writes**: a login you make on a site can be recorded in your real
iCloud Keychain, and a password you change can be updated in place - so it
reaches your other Apple devices. Strong password suggestions come from the
client too.

The canonical source of this extension is the `extension/` folder of the
[icp](https://github.com/Sank6/iCloud-Keychain-for-Linux) repository; this
repository is a standalone copy so it can be installed, versioned and shared
on its own. MIT licensed, like the project it comes from.

## How it works

```
browser page  <-- content script -->  extension  <-- native messaging -->  icp
                                                                  reads the local vault
```

`icp` decrypts your keychain into `~/.config/icp/vault.enc` (libsodium secret
box, key held in the GNOME keyring). The native host answers three requests:

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

1. Build the package:

   ```bash
   ./build-xpi.sh          # -> dist/apple-passwords-<version>.xpi
   ```

2. Sign it on AMO: <https://addons.mozilla.org/developers/> -> *Submit a New
   Add-on* -> *On your own* (unlisted). Unlisted is the right first step: the
   add-on gets signed and installable from its AMO URL without waiting for a
   review. Listing it later only adds the store entry.

   AMO asks for a source-code URL and a license - use this repository and the
   MIT license in `LICENSE.md`.

3. AMO gives the signed add-on its own gecko id. Register the native host with
   that id, so the host only talks to the add-on you installed:

   ```bash
   host/install.sh "" "<AMO_ADDON_ID>"
   ```

   The add-on id is in its AMO URL: `something@your-domain`.

4. Install it in Firefox from the AMO URL (`about:addons` -> gear ->
   *Install Add-on From URL*). A signed add-on needs neither
   `xpinstall.signatures.required` nor `extensions.autoDisableScopes`, and it
   updates itself.

## Security notes

* The extension is read-only: it never writes to the keychain.
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
* the `icp` Python package importable by the host - the launcher picks the
  repository's virtualenv, then the one behind an installed `icp` entry point,
  then `python3` on `PATH`

## Notes

* The native host is spawned by the browser, which does not pass
  `DBUS_SESSION_BUS_ADDRESS` on. The launcher points at the session bus
  itself, because the vault's master key lives in the GNOME keyring and is
  otherwise unreachable - which would show an empty password list.
* The extension is read-only. It never writes to the keychain.
