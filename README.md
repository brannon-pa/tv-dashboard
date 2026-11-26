# TV Dashboard

A minimal, Apple TV-style home screen for Samsung Tizen TVs, loaded through
[TizenBrew](https://github.com/reisxd/TizenBrew). It shows a large clock and date,
rotating nature wallpapers and a dock of streaming apps you can launch with the remote.

Built for a 2018 Samsung (Tizen 4.0), so it uses plain HTML, CSS and ES5 JavaScript:
no frameworks, no build step, about 20 KB of code plus about 1.9 MB of wallpapers.

## What gets installed

Nothing is changed on the TV's system. Only two things are added:

1. **TizenBrew**, a homebrew app launcher installed as a normal user app. Its only
   system change is that Developer Mode is on with Host PC IP set to `127.0.0.1`.
2. **This module**, entered in TizenBrew's module list as `brannon-pa/tv-dashboard`.
   TizenBrew loads these files from GitHub through the jsDelivr CDN each time it opens
   the dashboard. Nothing is copied into the TV's firmware.

| File | Purpose |
|---|---|
| `package.json` | Tells TizenBrew this is an app module (`appPath: index.html`) with a background service (`serviceFile: service.js`). |
| `index.html`, `style.css`, `app.js` | The dashboard itself. |
| `service.js` | A small launcher service that runs inside TizenBrew on `127.0.0.1:8093` (TV-only, not reachable from your network). It lists installed apps and launches them, because the dashboard page cannot launch apps itself. |
| `wallpapers/` | Eight 1920×1080 JPEGs, each 250 KB or less except `02` (about 370 KB) and `06` (about 290 KB). |

## Remote controls

| Button | Action |
|---|---|
| ← → | Move along the dock |
| OK / Enter | Open the selected app |
| Back | Leave the dashboard (returns to TizenBrew) |
| Red (A) | Diagnostics: shows whether the launcher works and every app ID the TV reports |
| Green (B) | Next wallpaper |

Wallpapers change every 5 minutes. The dashboard remembers the last selected app.

## Customising

- **Apps:** edit the `APPS` list at the top of `app.js`. Each entry has a display
  `name`, a `match` pattern for the app's name on the TV, and fallback `ids`.
  If an app won't open, press **Red** on the dashboard to see the real ID and add it.
- **Wallpapers:** add a JPEG (1920×1080, about 250 KB or less) to `wallpapers/` and to
  the `WALLPAPERS` list in `app.js`, then credit it below.

## How to update

TizenBrew loads the **latest git tag** of this repo, not the latest commit.

1. Commit your change and bump `version` in `package.json`.
2. Tag and push it:
   ```bash
   git tag v1.0.1 && git push && git push --tags
   ```
3. jsDelivr caches files for up to 12 hours. To skip the wait, open these purge links
   in a browser:
   - `https://purge.jsdelivr.net/gh/brannon-pa/tv-dashboard/package.json`
   - `https://purge.jsdelivr.net/gh/brannon-pa/tv-dashboard/app.js`
   - and likewise any other file you changed
4. On the TV, fully close TizenBrew (or restart the TV) and open the dashboard again.
   If you changed `service.js`, restart the TV, because the old service keeps running
   until then.

## How to remove it completely

1. **Remove the module:** open TizenBrew → Module Manager → select `tv-dashboard` → remove it.
2. **Remove TizenBrew (optional):** on the Samsung home bar, go to Apps → ⚙ Settings,
   select TizenBrew → Delete. Or highlight it on the home bar, press Down, and choose Remove.
3. **Turn off Developer Mode (optional):** go to Apps, type `1 2 3 4 5` on the remote,
   switch Developer Mode **Off**, then restart the TV.
4. **Delete the GitHub repo (optional):** on GitHub, go to the repo → Settings → Danger Zone →
   Delete this repository.

Nothing else on the TV was changed.

## Reinstalling after a firmware update

Samsung firmware updates can remove sideloaded apps and reset Developer Mode.

1. Check whether TizenBrew is still on the home bar or in Apps. If it is, open it.
   Your module list is usually kept.
2. If TizenBrew is gone, reinstall it with the
   [TizenBrew Installer](https://github.com/reisxd/TizenBrewInstaller/releases/latest):
   - Turn on Developer Mode (Apps, then `12345`) and set Host PC IP to your computer's IP.
   - Restart the TV and run the installer.
   - Set Host PC IP back to **`127.0.0.1`** and restart the TV again.
3. In TizenBrew, go to Module Manager → Add GitHub Module and enter `brannon-pa/tv-dashboard`.
4. If a newer firmware blocks TizenBrew, check the TizenBrew repo's issues and README
   for current support. Never install unofficial firmware to get around it.

## Troubleshooting

- **Black or blank screen:** the module name is probably mistyped, or the repo has no
  tag yet. TizenBrew needs at least one tag, such as `v1.0.0`.
- **Apps don't open (a message says "Couldn't open…"):** press **Red**.
  - If it says *Launcher service: NOT reachable*, restart the TV and try again.
  - If an app shows `--`, it wasn't found by name. Find its ID in the list and add it to
    `APPS` in `app.js`.
- **Back doesn't leave the dashboard:** press the Home button. Samsung may not let a
  TizenBrew page close itself.

## Wallpaper credits

All photos are from [Unsplash](https://unsplash.com) and used under the
[Unsplash License](https://unsplash.com/license). That license allows free use, and
credit is appreciated, not required. Each image was resized to 1920×1080 and recompressed.

| File | Photo | Photographer |
|---|---|---|
| `01-alpine-lake-eibsee.jpg` | [Zugspitze over the Eibsee, Bavaria](https://unsplash.com/photos/a30m9dBsWoA) | Philipp (@picture_scape) |
| `02-alpine-lake-klontal.jpg` | [Klöntalersee in winter, Switzerland](https://unsplash.com/photos/04gBRs76feg) | Christopher Politano (@poli_graphy) |
| `03-forest-misty-pines.jpg` | [Pines in mist, aerial](https://unsplash.com/photos/OYFHT4X5isg) | Dan Otis (@danotis) |
| `04-forest-evergreen-fog.jpg` | [Misty evergreen forest](https://unsplash.com/photos/fs5By_w0nxE) | Jacob Padilla (@jacob17pad) |
| `05-coast-torrey-pines.jpg` | [Torrey Pines cliffs, San Diego](https://unsplash.com/photos/LOFHydqLu80) | Lance Anderson (@lanceanderson) |
| `06-coast-knysna.jpg` | [The Heads, Knysna, South Africa](https://unsplash.com/photos/rfm-8YBZ3ks) | De wet Cilliers (@heydewet) |
| `07-desert-atacama-dunes.jpg` | [Dunes in the Atacama, Chile](https://unsplash.com/photos/RX2e0bMD73M) | Marek Piwnicki (@marekpiwnicki) |
| `08-aurora-lofoten.jpg` | [Aurora over Lofoten, Norway](https://unsplash.com/photos/1UZ5fAF2xLI) | Matthieu Gouiffes (@matthieu_gouiffes) |

App names are trademarks of their owners. This project ships no app logos; on the TV,
tiles use the icons of the apps installed on that TV.

## License

The code is MIT-licensed (see `LICENSE`). The photos remain under the Unsplash License.
