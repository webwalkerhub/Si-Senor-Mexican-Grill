# Si Señor Mexican Grill website

Built and maintained by Web Walker.

## Editing (no code)

Go to https://app.pagescms.org, sign in with GitHub, and open **webwalkerhub/si-senor-mexican-grill**.
Pick a screen (Today's specials, Business info & hours, Full menu, Food photos, Reviews…), change it, and click **Save**.
Netlify rebuilds the live site automatically in about a minute.

Tips:
- Hours and the weekly special time use a 24-hour clock: `11:00` = 11 AM, `17:00` = 5 PM.
- The Google rating and review count are typed once (Business info) and update everywhere on the page.
- Menu preview cards pull the first few dishes of the menu section you name, and the "See all" count updates itself.
- If a save has a mistake, the build stops with a plain-English message and the previous version stays live.
- The site is hidden from Google while it's a preview (SEO screen → "Hide this site from Google"). Turn that off at launch.

## How it works

- `content/*.json` – everything editable
- `src/page.html` – the design template
- `src/img/` – photos and icons
- `build.js` – combines them into `dist/` (no outside packages; Netlify runs `node build.js`)
- `.pages.yml` – the editing dashboard screens
