# The add-on's listing on addons.mozilla.org

Copy-paste for the store page. The *summary* is what AMO shows under the name
(it allows 64 characters); the *description* is the page itself.

## Summary

```
Your iCloud Keychain in Firefox: fill, save, and one-time codes.
```

That is 64 characters exactly. A shorter one, if you prefer:

```
Fill and save your iCloud Keychain logins, with one-time codes.
```

## Description

AMO takes the description as Markdown.

```markdown
Fill your iCloud Keychain into any site, without a cloud service in between.

This add-on is the browser front end of **Apple Passwords**, the native iCloud
Keychain app for Linux. Your keychain never leaves your own computer: the
add-on asks a small native host on the machine for what the page needs, and
that host is the only thing that ever touches the keychain.

### What it does

- **Fills your logins.** The account and the password of the site you are on,
  from your own keychain.
- **One-time codes, on the spot.** The secret behind a code never crosses into
  the browser: the code is generated when you ask for it, and again when it
  rolls over.
- **Records new logins.** A login you make on a site goes into the keychain,
  so it reaches your other Apple devices.
- **Updates changed passwords.** A password you change on a site is changed in
  the keychain too, in place.
- **Suggests strong passwords**, from the keychain client.
- **Hide My Email aliases**, for the site you are on.

### What it needs

- The **Apple Passwords** app, installed on the same machine and signed in to
  iCloud. Without it the add-on has nothing to show.
- The native messaging host, which the app installs (`host/install.sh`).

It is **not** for Firefox for Android: Android has no native messaging, and
the keychain is on your computer.

### Privacy

The add-on talks to no website. It asks the native host for the logins of the
domain of the page you are on, and for nothing else. A password is read from
the page only when you press the button in the popup, and it goes straight to
the keychain - the add-on never stores it.

### The source

Everything is open: the add-on is MIT licensed, and the client it talks to is
too.

- The add-on: https://github.com/einyx/icp-extension
- The client: https://github.com/einyx/apple-passwords
```

## The other fields

| Field | Value |
| --- | --- |
| Name | iCloud Passwords |
| Slug | `icloud-passwords` |
| Type | Extension |
| Category | **Productivity** (or *Security* if it is offered - both fit) |
| Tags | `password manager`, `autofill`, `two-factor authentication`, `privacy` |
| Homepage URL | https://github.com/einyx/apple-passwords |
| Source code URL | https://github.com/einyx/icp-extension |
| License | MIT License (`LICENSE.md`) |
| Icon | `icons/icon.png` (128×128, in the package) |
| Compatible with Firefox for Android | **No** |
| Contains AI-generated content | No |

## Notes to the reviewer

Only for a *listed* add-on (an unlisted one is signed without a review).

```text
This add-on is the browser front end of a native messaging host: a program on
the user's own computer, which holds the iCloud Keychain. It talks to no
website and needs no account of its own.

Firefox for Android has no native messaging, so the add-on is desktop-only.

To test it:

1. Install the client from the repository in the add-on's source code:
   https://github.com/einyx/apple-passwords (a .deb, an .rpm and a Flatpak are
   published with its releases).
2. Run its host/install.sh to register the native host.
3. Sign in to iCloud with the app (`icp login`). An Apple ID is needed for
   there to be anything to fill; a reviewer without one will see "The native
   host is not installed" or an empty list, which is the expected behaviour
   without a keychain behind it.
```
