# Apple Passwords - browser extension for [icp](https://github.com/Sank6/iCloud-Keychain-for-Linux)

A read-only iCloud Keychain autofill extension for Linux. It talks to the
`icp` client through a native-messaging host and fills your logins into the
page, the way the Passwords app does on a Mac or iPhone. Your one-time codes
are generated on the spot, never read from a stored copy.

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
| `{"cmd":"ping"}` | `{"ok":true,"count":515}` - how many logins are stored |
| `{"cmd":"match","domain":"..."}` | the logins for that domain, with a live one-time code |
| `{"cmd":"totp","domain":"...","username":"..."}` | a freshly generated one-time code |

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
