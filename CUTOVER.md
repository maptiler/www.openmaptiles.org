# Cutover runbook — replacing openmaptiles.org with this build

**Written:** 2026-08-03. **Status:** built, verified, and staged on
`labs.maptiler.com/www.openmaptiles.org/`. Not yet proposed to the `openmaptiles` org.

This document records what was verified about production, what was built to keep the
legacy URLs working, and the order the cutover has to happen in. **Read §0 and §1
before touching anything** — §1 is the step that breaks the site silently if it is
skipped.

---

## 0. Verified state of production

Everything here was read off the live site and the GitHub API on 2026-08-03, not
inferred from the repos.

| | |
|---|---|
| Production repo | `openmaptiles/www.openmaptiles.org`, branch `master`, path `/` |
| Pages build type | `legacy` — GitHub's own sandboxed Jekyll (3.x, `--safe`) |
| Custom domain | `CNAME` = `openmaptiles.org`; `https_enforced: false` |
| Edge | Cloudflare **proxy** in front of Pages, plus **existing zone Redirect Rules** |
| Live content | commit `01b3c99` (2026-03-18) — **the legacy Jekyll site** |

Two consequences that change the plan:

**The legacy documentation URLs are still live.** `/layers/water/` answers 200 from origin;
`/docs/schema/` 404s. So the ~25 legacy documentation URLs are not dead history — they
are live today and every one of them breaks on cutover unless something catches it.
That was treated as launch-blocking here, not cleanup.

**Cloudflare already redirects nine paths at the edge.** `/terms/` returns a 301
with no `x-github-request-id` header, i.e. Cloudflare answers before the origin is
consulted. The legacy repo's own meta-refresh stubs for those paths are dead code and
several of their targets had drifted from what the edge actually serves. The current
edge targets were read back off production and are what this build reproduces.

A pre-cutover baseline of all 39 legacy URLs is in
`script/legacy-baseline-2026-08-03.txt`, produced by `script/verify-live`.

**Do not overwrite it.** It is the only record of what production answered *before* the
cutover, and `verify-live` can only ever probe the site as it is now — so once the
cutover has happened that state cannot be reproduced, and the §5 diff has nothing to
compare against. After the cutover, write the new probe to a *different* file and diff
the two, keeping both.

---

## 1. The one action that silently destroys the site

**Settings → Pages → Source must be "GitHub Actions" on
`openmaptiles/www.openmaptiles.org` before this lands.** It is
`Deploy from a branch` today.

The incoming site has three custom plugins in `_plugins/`. GitHub Pages' built-in
build runs Jekyll in `--safe` mode, which skips `_plugins/` entirely and silently:

| Plugin | Produces | If skipped |
|---|---|---|
| `datapage_generator.rb` | 59 `/languages/:code/` + 7 `/styles/:slug/` from `_data/` | **66 pages cease to exist** |
| `codeblock.rb` | `.codeblock` wrapper + copy button around Rouge output | every fenced code block loses styling and its copy button |
| `doclinks.rb` | external-link treatment in docs | external links render bare |

It also ignores `Gemfile`, building with Jekyll 3.x instead of the pinned 4.4, which
changes Sass and kramdown behaviour.

Measured, not assumed: `bundle exec jekyll build --safe` on this tree produces **88**
HTML files instead of 153, and **exits 0**. No error, no warning, no failed check.

This is a repository setting. Nothing in git can enforce it, and `deploy.yml`'s
assertions only protect the site *if the workflow is what deploys*. The wrong Source
setting bypasses the workflow entirely.

**Flip it before the merge, not after.** With Source = GitHub Actions and no workflow
yet on `master`, nothing publishes and the last legacy deployment keeps serving. The
reverse order — merge first — publishes a 66-page-short site immediately.

---

## 2. What was built

### `script/verify-build`

One script, run by every workflow, that asserts the shape of a built `_site/` before
it is published. It checks the route floor, **one assertion per custom plugin** (so a
`--safe` build says which plugin was skipped, not just that the count is low), static
and generated assets, the `CNAME`, that no internal document leaked, and every legacy
URL in the manifest below.

Self-tested both ways: passes on a normal build, and on `--safe` fails with 5 findings —
the route floor plus all three plugins. Options: `SITE=`, `REQUIRE_CNAME=0`,
`EXPECT_SITEMAP=0`, `BASEURL=`.

### `script/redirects.tsv`

The manifest of every legacy URL that must keep working, its expected destination, and
whether `_redirects` must also carry it. 39 rows. `verify-build` walks it and asserts,
per row, that a stub exists, that it points at the expected target, and — for `both`
rows — that `_redirects` carries an identical rule. That last check is what stops the
two halves drifting, which is exactly how the inherited `_redirects` ended up
disagreeing with the live Cloudflare rules.

Adding a redirect without adding it here means nothing checks it.

### `script/verify-live`

Probes a deployed site and prints what each manifest URL actually resolves to,
following meta-refresh stubs that `curl -L` cannot. Reports, does not assert — a
legacy URL answering 200 before (real page) and 200 after (stub) is expected. Diff
the before and after runs.

### Redirect coverage — 39 URLs, as real HTML stubs

`_redirects` is a Cloudflare/Netlify format and **GitHub Pages ignores it**, so
nothing in it fires on the current host. Every rule is therefore also shipped as a
`jekyll-redirect-from` stub, which works on any static host:

| Group | Count | Owner |
|---|---|---|
| `/layers/*` → `/docs/schema/*` | 16 | `redirect_from:` in `_docs/schema/*.md` |
| `/schema/ /inspect/ /mobile/ /mobile-app/ /mobile/sourcecode/ /faq/` | 6 | `redirect_from:` on the destination page |
| `/languages/ /styles/ /styles/openstreetmap/` | 3 | `languages.html`, `styles.html`, `styles/openstreetmap.html` |
| off-site (9) | 9 | `support.html`, `terms.html`, `hosting.html`, `coordinate-systems.html`, `extracts.html`, `production-package.html`, `downloads.html`, `downloads-embed.html`, `docs/website/openlayers3.html` |
| legacy `.html` URLs | 2 | `redirect_from:` in `viewers.html`, `production-package-html.html` |
| pre-existing docs redirects | 3 | already present in `_docs/` front matter |

`/layers/*` is the schema reference and the most externally cited part of the site.

The nine off-site stubs duplicate rules the Cloudflare zone already serves, so they
are normally dead code. They are shipped anyway so the redirects survive the proxy
being set to DNS-only, the zone rules being rebuilt, or the site moving hosts — and
their targets were taken from the live edge so all three layers agree. Each file
carries a `TARGET MUST MATCH THE EDGE RULE` note.

### `_config.staging.yml` + `labs-staging.yml`

`maptiler/www.openmaptiles.org` publishes to `labs.maptiler.com/www.openmaptiles.org/`
— an org *project* page, i.e. a non-root path. Two things follow:

- `baseurl` must be `/www.openmaptiles.org`, or every absolute asset path 404s.
- `_site/CNAME` must be deleted before publishing, or the staging repo asserts
  ownership of `openmaptiles.org` on every push. GitHub only lets one repo hold a
  custom domain so it is refused today, but a workflow that keeps trying to take
  production's domain should not be left running. `verify-build` with
  `REQUIRE_CNAME=0` asserts it is really gone rather than trusting the `rm`.
- `_site/sitemap.xml` must be deleted too, for the same reason and by the same means
  (`EXPECT_SITEMAP=0`). It cannot be suppressed from config: `jekyll-sitemap` sits in
  the `Gemfile`'s `:jekyll_plugins` group, which Bundler auto-requires whatever
  `plugins:` says. Left in place it enumerates all 107 URLs of the duplicate site, and
  `robots.txt` only stops crawlers that read it.

The overlay also sets `staging: true`, which switches `robots.txt` to `Disallow: /`
and forces `noindex, nofollow` on every page. Without that, labs serves a complete
duplicate of openmaptiles.org and competes with it for the same queries. A `Disallow`
alone is not enough — it stops crawling, not indexing of URLs discovered elsewhere.

`jekyll-build.yml` builds and verifies the staging config on every PR, because a
`baseurl` mistake is invisible in the production build.

### Workflow guards

Both deploy workflows now key off `github.repository`: `deploy.yml` runs only on
`openmaptiles/www.openmaptiles.org`, `labs-staging.yml` only on
`maptiler/www.openmaptiles.org`. They share the `pages` concurrency group, and without
the guard the fork would publish a build carrying production's `CNAME` and canonical
URLs.

### Content fixes

- `/faq/`'s only Q&A (extracts and planet refresh weekly) folded into
  `_docs/generate/create-custom-extract/` as a *Data updates* section, with
  `redirect_from: /faq/`. Chosen over recreating `/faq/` because `_layouts/page.html`
  is a bare content shell — a markdown page rendered through it would have no styling.
- That doc's opening link pointed at `http://openmaptiles.org/downloads`: absolute,
  plain HTTP, and to a path that now 301s off-site. Repointed at the real destination.
- 10 internal doc links missing trailing slashes (`permalink: pretty` means each cost
  a redirect hop) — fixed.
- 3 links reading `](/)` where the legacy text said "OpenMapTiles styles" — repointed
  at `/#map-styles`, where the styles actually are.

---

## 3. Order of operations

**Done already.** The build is staged on `maptiler/www.openmaptiles.org` (branch
`port-jekyll-rewrite`, Pages Source = GitHub Actions) and serving at
`labs.maptiler.com/www.openmaptiles.org/`, with `/languages/de/` and
`/styles/osm-bright/` proving `_plugins/` ran under a real workflow, `robots.txt`
saying `Disallow: /`, and no `CNAME` or `sitemap.xml` served. All 39 legacy URLs
resolve there. The port branch is `port-jekyll-rewrite`.

What is left starts here. Step 3 is the point of no easy return.

**1. Review on labs.** This is where §5's product questions get answered, with the
pages in front of the reviewer.

**2. Open the PR against `openmaptiles/www.openmaptiles.org`** from
`port-jekyll-rewrite`. It is a tree replacement, not a patch — the commit already
removes every superseded file, so there is no deletion checklist to work through.
`jekyll-build.yml` runs on the PR and gates it on the same `verify-build` the deploy
uses.

**3. Flip production's Pages Source to *GitHub Actions* — before merging.** See §1.
Someone with admin on the `openmaptiles` org has to do this; a PR cannot, and neither
can anyone holding admin only on the fork. Nothing publishes at this point: `master`
has no workflow yet, so the last legacy deployment keeps serving.

**4. Merge.** `deploy.yml` fires, builds, runs `verify-build`, publishes only on pass.

**5. Verify live.**

```bash
script/verify-live > /tmp/after.txt
diff script/legacy-baseline-2026-08-03.txt /tmp/after.txt
```

Expect ~25 rows to differ, and check each against §0: a URL that was a real page and
is now a stub to its new home is the intended outcome. Cloudflare caches HTML for 10
minutes (`cache-control: max-age=600`) — either wait or purge the zone cache. Then
spot-check that `/docs/schema/water/` renders code blocks with copy buttons, and that
`sitemap.xml` lists 107 URLs (production serves none today, so this is new).

**6. Rollback, if needed.** GitHub Pages keeps previous deployments: Actions → *Deploy
to GitHub Pages* → last green run → *Re-run all jobs*. Or revert the merge and push.
There is no artifact to hand-roll back to; `_site/` is not committed. Note that once
Source is *GitHub Actions*, reverting to the legacy tree also needs Source set back to
*Deploy from a branch* — the legacy tree has no workflow.

---

## 4. What the port removes

No action needed — the commit already deletes all of it. Listed so a reviewer reading a
350-file diff knows the removals are deliberate:

`_config.yaml` (this build ships `_config.yml`) · the `styles/` submodule, uninitialised
and pointing at `klokantech/styles`, whose path collided with the generated
`/styles/:slug/` routes · `layers/` (16 `.md`, now `_docs/schema/*`) · `languages/`
(60 `.md`, now `_data/languages.json` + `datapage_generator.rb`) · `css/ js/ fonts/`
(now `assets/`) · `_custom.scss` `base.scss` `_variables.scss` `_fonts.scss` (now
`_sass/`) · `_includes/maptilerbanner.html` · `_layouts/default.html`
`_layouts/languages.html` · `generate-jekyll-layer-docs.sh` · `inspect/` (now
`inspect-tool/`) · and the page files replaced by this build's own routes and stubs.

Two things worth knowing while reviewing:

- `CNAME` is identical in both trees and is left alone.
- `styles.html`, `production-package.html`, `support.html`, `terms.html`,
  `hosting.html`, `coordinate-systems.html` and `extracts.html` exist in **both** trees
  under the same names with different contents. The incoming version wins in each case,
  so the diff shows them as modified rather than added.

---

## 5. Still open — not engineering calls

Neither is a port defect. Both are best answered on the labs staging site, with the
pages in front of the reviewer — §3 step 1.

1. **Three docs that were off-site redirect stubs are now full articles** —
   `website/leaflet` (19 → 144 lines), `website/maptiler-sdk-js`, `style/maptiler-cloud`.
   Three off-site redirects disappeared as a side effect.
2. **Five docs expanded 3–8×** with marketing-toned prose — and `mobile/mobile` now
   ranks **MapTiler Mobile SDKs (Recommended)** above MapLibre Native, reversing the
   legacy recommendation. That is product positioning.

Two smaller items for whoever owns the Cloudflare zone:

3. **`https_enforced` is `false`** on the Pages config, so GitHub's own HTTPS redirect
   is off and its trailing-slash redirects emit `http://` locations. Cloudflare masks
   this at the edge today. Worth turning on once the custom domain is confirmed
   healthy after the cutover.
4. **The nine edge redirect rules are undocumented outside this file.** Their targets
   are recorded in `script/redirects.tsv` and in each stub's front matter, read off
   production on 2026-08-03. If the dashboard is reachable, export the ruleset and
   check it against the manifest — `/extracts/` in particular chains through a
   `cloud.maptiler.com` auth widget, which may not be intentional.

---

## 6. Two deliberate omissions, and three content fixes reapplied

### The two `/maps/` Leaflet embeds are dropped on purpose

`/maps/leaflet-mapbox-gl.html` and `/maps/leaflet-vectorgrid.html` answer **200** on
production today and are absent from this build, so those two URLs begin to 404. Note
that only the `.html` URLs are live — their pretty-permalink variants
(`/maps/leaflet-mapbox-gl/`) already 404. The reasoning, so it is not relitigated:

- **Nothing links to them** in either tree, and production serves **no sitemap at all**
  (`/sitemap.xml` 404s there), so they were never listed in one. They were already
  orphaned: their natural host page, `docs/website/leaflet.md`, was a meta-refresh stub
  rather than an article. The embeds that survive are wired up —
  `_docs/website/openlayers.md` iframes `/maps/ol.html`, and
  `_docs/website/maplibre-gl-js.md` iframes `/maps/maplibre-gl-js.html`.
- `leaflet-mapbox-gl.html` is **already half-broken in production**: it passes
  `accessToken: '{token}'`, an unsubstituted literal placeholder. It also loads
  `/js/leaflet-mapbox-gl.js`, and the whole `js/` directory is superseded by `assets/`.
- It pulls **mapbox-gl-js v0.35.1**, the library this rewrite replaces with MapLibre
  throughout — the same decision as the `/docs/website/mapbox-gl-js/` →
  `/docs/website/maplibre-gl-js/` redirect in `script/redirects.tsv`.

If one should come back, `leaflet-vectorgrid.html` is the safe choice: self-contained,
no missing dependency, no deprecated library. Add it to `script/redirects.tsv` or
nothing will check it.

### `docs/media/` keeps its single file

`docs/media/` holds one image, and folding it into `media/` looks like free tidying. It
is not: `/docs/media/tileserver-php_1.png` answers 200 today, and
`jekyll-redirect-from` emits HTML stubs, which cannot redirect a binary. Moving it
breaks a live URL with nothing able to catch it.

### Three commits were regressed by the rewrite and reapplied by hand

This build branched before the last three commits on `master`, and the rewrite lost
what they fixed. Two are restored in their new locations; the files they originally
touched no longer exist.

| Commit | Change | Restored in |
|---|---|---|
| `01b3c99` (#100) | "free **(for non-commercial use)** reliable maps API" | `_docs/raster/maptiler-cloud.md` |
| `1e56512` (#102) | Stamen cartography is **CC-BY**, not CC0 | `_data/styles.json`, Positron and Dark Matter |
| `9dc60cf` (#111) | retargeted a "Develop your own mobile app" button on `mobile.html` | **nothing to restore** — that page and button are both gone. The surviving Flutter link in `_docs/mobile/mobile.md` resolves |

Worth checking on review, since a rebase would regress all three again.
