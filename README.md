# Fast Insta Switcher

Switch Instagram accounts with one shortcut. A Chrome and Brave extension.

Instagram's own switcher logs you out and back in. This extension keeps each account's login saved and swaps them in place, so a switch takes one page load.

## Install

1. Download `fast-insta-switcher.zip` from the [latest release](../../releases/latest) and unzip it.
2. Open `chrome://extensions` (or `brave://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.

## Set up

1. Log in on instagram.com. Open the extension and press **Save login**.
2. Press **Add another account**, log in to your second account and press **Save login** again.
3. Press `Alt+Shift+S` on an Instagram tab to switch. With three or more accounts, the shortcut cycles through them.

Don't use Instagram's own Log out or account switcher. Both end your saved logins, and you'll need to log in and save again.

To change the shortcut, click it in the extension's header.

## How it works

Each account's login lives in a few cookies (`sessionid`, `ds_user_id` and some others). The extension saves those per account and swaps them on a switch. Device cookies stay put, so Instagram sees one device with several accounts.

After your second save, the extension compares the two accounts and works out which cookies to swap.

If Instagram ends a session (password change, new IP, its own checks), the account shows a red **!**. Log in to it and save again.

## Settings

- **Open saved posts after a switch**: on by default. Turn it off to reload the page you're on.
- **Clear site data on switch**: turn this on if the old account's feed sticks after a switch.
- **Video player**: each of these can be turned off on its own.
  - **Seek bar**, **Volume slider**, **Playback speed** (0.25× to 16×) and **Fullscreen button** show in a bar when you hover a video. In fullscreen, the browser's own controls take over.
  - **Auto-scroll Reels**: on instagram.com/reels, moves to the next Reel when one ends.
  - **Feature menu on ?** and **Corner ? button**: open a list of everything the extension does.

## Privacy

Your logins stay in your browser's local extension storage and never leave your computer. Only the video player on/off settings sync with your browser account. The extension only talks to instagram.com, and only to look up usernames. Anyone who can read your browser profile folder can read the saved logins, same as your normal cookies.

## Development

`node check.mjs` runs the tests.
