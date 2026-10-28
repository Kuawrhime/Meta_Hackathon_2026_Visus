# Video immersion — platform support and limitations

VISUS video learning reuses the same vocabulary, dictionary, levels,
review schedule and statistics as web pages and books. A word graded in
a video is the same IndexedDB entry everywhere.

## YouTube

- Watch pages only. Caption tracks are read from player data the page
  exposes (`ytInitialPlayerResponse`); manual and automatic tracks both
  work when YouTube provides them.
- Subtitle language can be switched in the sidebar; SPA navigation is
  handled by re-detecting the video key, without duplicate sidebars.
- Videos without captions show an explicit message in the sidebar and
  offer SRT/VTT import. Nothing is fabricated.

## Netflix

- No DRM bypass, no protected-buffer access, no private APIs.
- VISUS reads subtitle text the Netflix player itself renders visibly
  in the page, timestamped from the playing video element.
- If a title/region renders subtitles outside the accessible DOM (for
  example canvas-only rendering), VISUS shows an honest unavailable
  state and offers SRT/VTT import instead.
- Netflix behaviour depends on Netflix's own player markup, which can
  change without notice. It has not been verified against a live
  Netflix account in automated tests; verify manually after Netflix
  player updates.

## Generic HTML5

- Any page whose player exposes HTML5 text tracks gets the sidebar
  with clickable, gradeable words.

## Controls and data

- Replay / previous / next, playback speed, auto-pause, pause-on-new-word,
  subtitle visibility, subtitle search, resume position, and statistics
  (lines seen, unique words, new/learning/known, listening time) all use
  real playback activity. Statistics are never invented.
- Imported SRT/VTT is capped at 2 MB, validated for timing lines, and
  rendered as plain text only.
- Sidebar size, collapsed state and position, widget position, and
  per-video resume points persist in local storage on the device.

## Browser notes

- Chrome and Firefox builds are produced from the same source
  (`npm run build:chrome`, `npm run build:firefox`). Content UI is
  scoped to VISUS-owned nodes and never styles host pages globally.
- Fullscreen: the sidebar moves inside the fullscreen element when the
  video is fullscreened, where the browser permits it.
