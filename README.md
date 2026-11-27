# TV Dashboard

A minimal, Apple TV-style home screen for Samsung Tizen TVs, loaded through
[TizenBrew](https://github.com/reisxd/TizenBrew). It shows a large clock and date, weather,
your upcoming calendar events, rotating nature wallpapers and a dock of streaming apps you can
launch with the remote.

Built for a 2018 Samsung (Tizen 4.0), so it uses plain HTML, CSS and ES5 JavaScript:
no frameworks, no build step, about 70 KB of code plus about 1.9 MB of wallpapers.

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
| `ical.js` | Reads calendar (.ics) files, including repeating events. |
| `service.js` | A small service that runs inside TizenBrew on `127.0.0.1:8093` (TV-only, not reachable from your network). It lists and launches installed apps and downloads your calendars, because the dashboard page can't do either itself. During calendar setup only, it also shows a form on port 8094 of the TV's Wi-Fi address. |
| `wallpapers/` | Eight 1920×1080 JPEGs, each 250 KB or less except `02` (about 370 KB) and `06` (about 290 KB). |

## Remote controls

| Button | Action |
|---|---|
| ← → | Move along the dock |
| ↑ / ↓ | Move between the dock, the calendar and the weather |
| OK / Enter | Open the selected app (or set up the calendar or weather) |
| Back | On the dock: asks "Exit the dashboard?" (Stay is selected; choose Exit to leave). Elsewhere: returns to the dock |
| ↓ on the dock (or Red / A) | Diagnostics: shows whether the launcher works, each calendar's status and every app ID the TV reports. ↑ or Back closes it. |
| Green (B) | Next wallpaper |

Wallpapers change every 5 minutes and follow the time of day: bright photos from 7 AM to 6 PM,
darker ones in the evening and at night. Each wallpaper's `when` tag in `app.js` (`day`, `night`
or `any`) controls this. The dashboard remembers the last selected app.

## Weather

The top-right corner shows the current temperature, conditions and today's high and low,
updated every 30 minutes from [Open-Meteo](https://open-meteo.com), which is free and needs no account.
If Open-Meteo is unreachable, the dashboard falls back to the US
[National Weather Service](https://www.weather.gov/documentation/services-web-api) (also free).
After a failure it retries every 5 minutes.

**Weather effects:** when it's raining, snowing, stormy or foggy where you are, a light animation
plays over the wallpaper: drizzle, rain, heavy rain, rain with lightning flashes, falling snow or
drifting fog. Clear and cloudy weather show none. The effects only slide pre-drawn layers, which the
TV's graphics chip handles, so they stay smooth on older TVs. To see them all on the TV, open
diagnostics (**↓** on the dock) and press **OK**: each effect plays for 5 seconds with a label. To turn them off, set
`WX_EFFECTS = false` in `app.js`. To preview one in a browser, open `index.html?fx=snow` (or
`drizzle`, `rain`, `heavy`, `thunder`, `fog`, `none`).

**To set it up:** press **↑** to select the weather, press **OK**, and enter your ZIP code.
Use ← → to choose a digit and ↑ ↓ to change it, then press **OK**.
Enter `00000` to turn weather off. ZIP codes missing from the free ZIP databases (some newer ones) are resolved through a nearby ZIP in the same area.

**Privacy:** your ZIP code and its approximate coordinates are saved only on the TV, in the
dashboard's local storage. They are never in this repo. The TV sends those coordinates to
Open-Meteo to get the forecast.

## Calendar

The panel under the weather lists upcoming events from up to three calendars, for example three
Gmail accounts: today, tomorrow, then the rest of the week, with a coloured dot per calendar.
If there are more than fit, the panel says how many more there are today. Select the panel (**↑**) and
press **OK** to see every event in a full-screen agenda; **↑ ↓** scroll it, **OK** opens calendar
setup, and **Back** closes it.
Calendars are downloaded every 15 minutes, so a new or changed event appears within about
15 minutes. Repeating events, edited or cancelled repeats, and all-day events are supported.

**To set it up**, you need each calendar's private link:

1. In [Google Calendar](https://calendar.google.com) on a computer, open **Settings** (the gear icon).
2. Under **Settings for my calendars** on the left, select the calendar, then **Integrate calendar**.
3. Copy **Secret address in iCal format**. Repeat for each account.
4. On the TV, press **↑** to select the calendar panel, then press **OK** (once calendars are set up,
   press **OK** again from the agenda). The TV shows an address
   like `http://192.168.1.50:8094` and a 4-digit code.
5. On a computer or phone on the same Wi-Fi, open that address, name each calendar, paste its
   link, enter the code and select **Save to TV**.

To change or remove calendars later, do step 4 again. Leave a link empty to keep the current one,
or tick **Remove all calendars from the TV**. **Show times only** shows the calendar's name
in place of each event's title, for when others can see the TV.

**Privacy:**
- Calendar links and events are saved only on the TV, in the dashboard's local storage.
  They are never in this repo.
- Anyone with a secret link can read that calendar. If one leaks, open the same Google setting
  and choose **Reset**; the old link stops working.
- The setup form is on your Wi-Fi only while the setup screen is open. It needs the code shown
  on the TV, locks after 5 wrong codes, and closes after saving or after 10 minutes.
- Google Workspace (work or school) accounts may have secret links turned off by their admin.

## Joke of the day

A short, family-friendly joke appears under the date and changes at midnight. The jokes are
built into `app.js` (the `JOKES` list), so nothing is downloaded. Set `SHOW_JOKE = false` to hide it.

To reach it, select the calendar (**↑**) and press **←**. Then choose **Next joke** or **Dismiss** with
**← →** and press **OK**. Dismiss hides the card until the next day, so the wallpaper shows through.

## Always-on behaviour

- **Ambient mode:** after 3 minutes with no button presses, the dock fades away and the calendar
  fades and shrinks to the next few events, leaving mostly the clock and wallpaper. The clock drifts slightly every few minutes. Any button
  brings the dock back; that first press only wakes it.
- **Night dimming:** the screen dims from 11 PM to 6 AM.
- **Daily refresh:** the page reloads itself at 4 AM, so it stays fresh when left on for days.

You can change these in the settings block at the top of `app.js` (`IDLE_MS`,
`NIGHT_START`, `NIGHT_END`, `RELOAD_HOUR`, `USE_TV_ICONS`, `WX_EFFECTS`, `SHOW_JOKE`).

### Opening the dashboard automatically

- **Auto-reopen after standby:** when the TV is switched on again after being put in standby with
  the remote, it may open its own live-TV / Samsung TV Plus screen. The dashboard's service notices
  the TV waking up and reopens TizenBrew a few seconds later. This only works if TizenBrew was
  already running before standby, and if TizenBrew's Autolaunch is set to the dashboard (see below).
  The diagnostics screen shows whether it's active and how many wake-ups it has seen.
  To turn it off, set `REOPEN_ENABLED = false` in `service.js`.

- In **TizenBrew**, open **Settings** → **Autolaunch Settings**, select **Dashboard** and confirm.
  TizenBrew will then open the dashboard as soon as it starts.
  To skip auto-launch once, hold **Up** while TizenBrew is opening.
- On the TV, go to **Settings → General → Smart Features** and set **Autorun Last App** to **On**,
  so the TV reopens TizenBrew (and therefore the dashboard) when it turns on.
- To stop the TV switching itself off while the dashboard is showing, turn off
  **Auto Power Off** and **No Signal Power Off** (Settings → General → Eco Solution), and turn off
  or lengthen **Auto Protection Time** (Settings → General → System Manager).

## Customising

- **Apps:** edit the `APPS` list at the top of `app.js`. Each entry has a display
  `name`, a `match` pattern for the app's name on the TV, and fallback `ids`.
  If an app won't open, press **↓** on the dock (diagnostics) to see the real ID and add it.
- **Wallpapers:** add a JPEG (1920×1080, about 250 KB or less) to `wallpapers/` and to
  the `WALLPAPERS` list in `app.js`, then credit it below.

## How to update

TizenBrew loads the **latest git tag** of this repo, not the latest commit.

1. Commit your change and bump `version` in `package.json`. Don't add `?v=` or other query
   strings to the file links in `index.html`: TizenBrew then fails to load those files.
   To test the weather backup in a browser, open `index.html?wx=nws`.
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

To test the calendar in a desktop browser, put a test `.ics` file in a `dev/` folder (ignored by git)
and set the `dash.cal.cfg` local-storage value to
`{"cals":[{"name":"Test","url":"dev/test.ics"}]}`. Calendar setup itself only runs on the TV.

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
- **Apps don't open (a message says "Couldn't open…"):** press **↓** on the dock.
  - If it says *Launcher service: NOT reachable*, restart the TV and try again.
  - If an app shows `--`, it wasn't found by name. Find its ID in the list and add it to
    `APPS` in `app.js`.
- **Calendar shows nothing or "Last updated…":** press **↓** on the dock and look under *Calendars* on the diagnostics screen.
  `ERROR HTTP 404` usually means the secret link was reset; set it up again with the new link.
  Any other error, such as a certificate error, means the TV couldn't reach Google.
- **The setup address doesn't open:** make sure the computer or phone is on the same Wi-Fi as
  the TV, and type the address exactly, including `:8094`.
- **Back doesn't leave the dashboard:** press the Home button. Samsung may not let a
  TizenBrew page close itself.

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Backup forecasts from the US National Weather Service
(public domain). ZIP lookups via Open-Meteo and [Zippopotam.us](https://zippopotam.us).

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
