# Clutch

Switch Instagram accounts with one shortcut, plus video controls, Reels auto-scroll, transcripts and background play. A Chrome and Brave extension.

Instagram's own switcher logs you out and back in. This extension keeps each account's login saved and swaps them in place, so a switch takes one page load.

## Install

1. Download `clutch.zip` from the [latest release](../../releases/latest) and unzip it.
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

## Your story

Instagram's website only lets phones post stories. The extension adds a **Your story** button at the start of the stories bar on the home feed: pick a photo or video, edit it, press **Add to your story**. The upload runs through Instagram's own story code, so its usual toasts and the stories bar refresh as normal. Only the final "add to story" request tells Instagram it comes from an iPhone.

In the editor:

- **Move, resize, rotate**: drag the photo or video; scroll (or pinch on a trackpad) to resize it, `Shift`+scroll to rotate. Whatever doesn't fill the 9:16 frame shows a blurred copy of the picture, like on the phone. The same works on texts and the song card.
- **Aa** adds text: type (`Enter` for a new line), pick a colour, **A** puts it on a box of that colour, the slider sets its size. Click a text to edit it again.
- **♫** adds music from Instagram's website search. Pick a song, then choose the part that plays (it starts at the song's chorus, as on the phone). Click the song card to change the part again.
- Drag a text or the song card onto the bin to remove it. `Esc` closes the text, music or song-part controls first, then the editor.

A photo with a song becomes a 15-second video; a video plays the song instead of its own sound (up to 60 seconds). The song is mixed into the video and the card is drawn on it, so it isn't a tappable Instagram music sticker. A video you've edited, or any story with a song, is recorded in real time before it uploads: keep the tab open until it's done. A photo without a song needs no recording. Drawing and other stickers aren't available.

## Buttons on bot DMs

Automated DMs (the "comment and I'll DM you the link" kind) often carry buttons like "Yes, that's me ✅" or "Get the guide". The Instagram app shows them; the website gets them but doesn't draw them when the message is text only. The extension draws them under the message. A link button opens its page in a new tab. A reply button sends its reply through Instagram's own code, the same as tapping it in the app, so the button's text shows up in the chat as your message.

## Settings

- **Open saved posts after a switch**: on by default. Turn it off to reload the page you're on.
- **Clear site data on switch**: turn this on if the old account's feed sticks after a switch.
- **Video player**: each of these can be turned off on its own.
  - **Seek bar**, **Volume slider**, **Playback speed** (0.25× to 16×) and **Fullscreen button** show in a bar when you hover a video. In fullscreen, the browser's own controls take over. Volume and sound on/off are remembered, however you change them (including the fullscreen controls). A remembered unmute applies right away if Chrome allows sound on Instagram before a click (it does once you often watch with sound there), otherwise on your first click or key press.
  - **Transcript button** (CC in the bar): shows and copies a Reel's text. It uses Instagram's own auto-captions when the Reel has them (few do); otherwise it transcribes the audio on your computer with Whisper (base, multilingual, language detected automatically). That runs on the CPU, takes about half the Reel's length, and the first time downloads an 80 MB speech model (the panel shows progress) from Hugging Face, which is then cached. Nothing is sent to a paid service.
  - **Auto-scroll Reels**: on instagram.com/reels, moves to the next Reel when one ends.
  - **Keyboard shortcuts**: `Space` plays/pauses, `M` mutes/unmutes, `F` toggles fullscreen, `←` / `→` go back or forward 5 seconds. In stories and the post viewer (opened from Saved, a profile or Explore) plain arrows stay Instagram's for changing story or post, and `Shift+←` / `Shift+→` seek instead. `Space` only plays/pauses on Reels, posts, stories and in fullscreen; on the feed, profiles and Explore it scrolls the page as usual. They act on the fullscreen video, else the one under the pointer, else the one playing.
  - **Keep playing in background**: videos don't pause when you switch to another tab.
  - **Feature menu on ?** and **Corner ? button**: open a list of everything the extension does.

## Privacy

Your logins stay in your browser's local extension storage and never leave your computer. Only the video player on/off settings sync with your browser account. The extension only talks to Instagram, to look up usernames and, when you press CC, a video's captions or video file (from instagram.com and its CDN), plus Hugging Face once, to download the speech model. Transcription runs on your computer; the audio never leaves it. Anyone who can read your browser profile folder can read the saved logins, same as your normal cookies.

## Development

`node check.mjs` runs the tests. Before loading the repo as an unpacked extension, run `sh vendor.sh` once to fetch the speech-to-text libraries into `vendor/`.

To release, bump `version` in `manifest.json` and push to `main`. The Release workflow builds `clutch.zip` and publishes it.
