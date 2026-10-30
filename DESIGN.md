# Keycap design system

Every interface this extension adds follows one idea: **the keyboard shortcut is the product.** The
UI looks like a keyboard. Shortcuts are drawn as physical key caps, buttons press down like keys,
and handles are set in monospace like text you type. Use these rules when you add or change UI so
new screens match the existing ones.

## Where it applies

| Surface | File | Where the tokens live |
| --- | --- | --- |
| Popup | `popup.html`, `popup.js` | `:root` in `popup.html` |
| Setup card | `intro.js` | literal values in its shadow-root `<style>` |
| Corner `?` button, feature menu, transcript panel | `video.js` | `.corner, .menu` rule in its shadow-root `<style>` |

**Out of scope: the video player bar** (`.bar`: seek, volume, speed, fullscreen, CC) in `video.js`.
It keeps its own look: a gradient overlay, the `#e8458f` range accent and a `#8f98ff` focus ring.
Don't restyle it with these tokens, and don't let new rules leak into it. Scope new rules in
`video.js` under `.menu` or `.corner`, never as bare element selectors.

Content scripts render inside closed shadow roots, so they can't share a stylesheet. Each surface
keeps its own copy of the tokens. **This file is the source of truth.** When a value changes,
change it in all three places.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#1a1b1e` | Panel background |
| `--well` | `#141517` | Sunken areas: shortcut hero, inputs, transcript text |
| `--cap` | `#2a2b30` | Key face: buttons, kbd, hovered or active row, toggle track |
| `--cap-edge` | `#0e0f11` | Key edge (the inset bottom shadow) |
| `--line` | `#2e2f35` | Borders and dividers |
| `--text` | `#ecebe8` | Primary text; also the focus ring |
| `--muted` | `#8d8c92` | Secondary text, tags, section labels, toggle knob when off |
| `--pink` | `#ff4f9a` | The single accent: active account, primary key, toggle knob when on, last key of a shortcut |
| `--pink-edge` | `#b8306c` | Edge of a pink key |
| `--on-pink` | `#1a0b12` | Text on pink and on red. Always dark: white on pink fails contrast |
| `--red` | `#ff6b5e` | Dead login, delete confirm, errors |
| `--red-bg` | `#3a1e1c` | Error box background |
| `--mono` | `ui-monospace, "Cascadia Mono", Consolas, monospace` | Keys, handles, tags, section labels |

Account colors are separate from these tokens. They come from `COLORS` and `accountColor()` in
`src/switch.js`, and the toolbar badge uses the same function. Never hard-code an account color.

**Pink budget.** Pink marks only "this one", "do this" and "on". Don't use it for decoration,
headings or borders. Give each screen one pink key at most.

## Type

- Body: `system-ui` at 13px with line-height 1.45. Secondary text is 12px `--muted`. Don't go below 11px.
- Titles: 15px at weight 650. Only panels on Instagram have a title. The popup has none, because the shortcut hero leads.
- Monospace (`--mono`) is for things you type or press: key caps, account handles (12.5px), tags
  (11px) and section labels (11px, 600 weight, uppercase, 1px letter-spacing).
- Never set prose in monospace.

## Shapes and components

**Key:** the one control shape. Use a 7px radius, the `--cap` face and `box-shadow: inset 0 -3px 0 var(--cap-edge)`.
On `:active` it moves `translateY(2px)` and the edge shrinks to 1px, so it looks pressed in.
The transition is `transform .06s, box-shadow .06s`.
- `.key`: secondary action.
- `.key.pink`: primary action, one per screen at most. It uses the `--pink-edge` edge and `--on-pink` text.
- `.key.wide`: full-width key.

**kbd (key cap):** a shortcut key drawn as a key. It has the same face and edge as a button key.
- Large, for the popup hero: 12px mono at weight 600, 6px radius, 3px edge.
- Inline, inside text: 11px with `padding: 1px 5px 3px` and a 2px edge.

Draw one cap per key. The last cap of a combo is pink because it is the key that triggers the
action. Split shortcut strings with this pattern (macOS strings such as `⇧⌥S` have no `+`):
`s.includes("+") ? s.split("+") : [...s]`.

**Account row:** a flat row with no card around it. It has a 7px radius and gets the `--cap`
background on hover and when active. The active row also has a 3px pink bar on its left edge.
From left to right it contains:
- Badge: 26×20 with a 4px radius, the account color, and white initials in 10px mono at weight 700. It mirrors the toolbar badge.
- Handle: 12.5px mono, cut off with an ellipsis when too long.
- Tag: 11px mono, lowercase. The tags are `now` (pink), `next` (muted), and `log in again` (red, for a dead login, whose badge becomes a red outlined `!`).

Rename and delete icons fade in over the tag on hover or focus. Deleting takes two clicks: the
first click arms it and shows a red `Delete?` key.

**Tag:** lowercase 11px mono. Use it for state, such as `now`, `next`, `on` and `off`. Don't use a pill or a badge for state.

**Toggle:** a 34×20 track with a 5px radius in `--cap`, with an inner shadow. The knob is a
14×14 square with a 3px radius: muted on the left when off, pink on the right when on. It moves
in 0.12s. Use a native `<input type="checkbox">` with `appearance: none`.

**Panel** (for anything injected into Instagram): `--bg` background, a 1px `--line` border, 10px
radius, 16px padding and `box-shadow: 0 12px 40px rgba(0,0,0,.5)`. It rises 6px over 0.16s when it
appears. Use a high z-index and put it in a shadow root.

**Well:** a sunken `--well` area with a 7–10px radius. Use it for the shortcut hero, inputs and
read-only text such as a transcript.

**Section label:** an uppercase mono `--muted` label, like `SETTINGS` or `VIDEO PLAYER`.

**Focus:** a 2px `--text` outline with a 2px offset. It always shows on `:focus-visible`.

## Motion

There are only three motions, and all are short:
1. A key press: 60ms down.
2. A toggle knob slide: 120ms.
3. A panel rise: 160ms ease-out.

Rename and delete icons also fade in over 100ms. Wrap every motion in
`@media (prefers-reduced-motion: reduce)` so it switches off. Add no other animation.

## Copy

- Buttons say what they do: "Save login" and "Add another account", not "Submit" or "OK".
- Tags and labels are lowercase mono words: `now`, `next`, `on`.
- Explanations are one plain sentence in muted 12px text. Don't put notes about how the UI was made in the UI.

## Checklist for new UI

1. Reuse a component above before adding a new shape.
2. Use only the tokens listed. If you need a new color, add it here first, then to all three copies.
3. Use at most one pink key per screen.
4. Set things you press or type in mono, and prose in `system-ui`.
5. Show every shortcut as one cap per key.
6. Make sure the new UI works with keyboard focus and with reduced motion.
7. Leave the video player bar alone.
