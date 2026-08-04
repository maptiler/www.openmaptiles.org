# openmaptiles.org

Source for the [OpenMapTiles](https://openmaptiles.org) website. A plain **Jekyll 4**
static site at the repo root. No JavaScript build step: JS ships as hand-written ES
modules, and the two vendored libraries (lunr, the MapTiler SDK) are committed under
`assets/js/vendor/`.

```bash
bundle install
bundle exec jekyll serve     # http://localhost:4000
bundle exec jekyll build     # -> _site/
```

Ruby **3.3.6**, pinned in `.ruby-version`. Node is not required and nothing here uses
npm. Map canvases stay blank on `localhost` — the MapTiler API key is domain-restricted,
which is expected, not a bug.

## Branches

| Branch | Contents | Deploys to |
|---|---|---|
| `master` | mirror of `openmaptiles/www.openmaptiles.org` — the current live site | nothing |
| `port-jekyll-rewrite` | the Jekyll rewrite exactly as proposed upstream — **no fork or cutover machinery** | nothing |
| `cutover` | this branch: `port-jekyll-rewrite` plus that machinery | nothing — **local only, never pushed** |

This is a fork. Production is `openmaptiles/www.openmaptiles.org`, and no port PR has
been opened against it yet. `master` is kept identical to upstream so that stays a
single tree replacement rather than a diverged merge.

**This branch is local only and is never pushed.** It exists so `port-jekyll-rewrite`
can stay clean, and so the cutover runbook and the pre-cutover baseline are kept
somewhere. Two consequences:

- `labs-staging.yml` triggers on this branch, so while it is unpushed **nothing deploys
  to labs**. The last labs build is from `fed6cd0e`, which is content-identical to the
  pushed tree because the strip changed no site output. Push this branch if labs needs
  to move again.
- `script/legacy-baseline-2026-08-03.txt` exists in one place only, this working copy.
  It records what production answered before the cutover and cannot be regenerated
  afterwards, so back it up somewhere that is not this laptop.

**Work on `port-jekyll-rewrite` and rebase this branch onto it — never the reverse.**
This branch is a single additive commit, so the rebase is trivial as long as it stays
that way.

## Before changing anything

Two things are load-bearing and easy to break silently:

- **Pages Source must be "GitHub Actions."** The built-in Pages build runs Jekyll in
  `--safe` mode, which skips `_plugins/` and *exits 0* — measured, 88 HTML files instead
  of 153, with no error. `datapage_generator.rb` alone produces 66 of those pages from
  `_data/`.
- **Nothing publishes unless `script/verify-build` passes.** It asserts the route floor,
  one check per custom plugin, the generated assets, every in-site link and image, and
  all 39 legacy redirects in `script/redirects.tsv`. Adding a redirect without adding it
  there means nothing checks it.
- **The 39 legacy URLs in `script/redirects.tsv` are live and indexed.** `/layers/*` is
  the schema reference and the most externally cited part of the site. Each is shipped as
  a `jekyll-redirect-from` stub; rename a doc and drop its `redirect_from` and the URL
  keeps answering until the release that removes it, which is why the check exists.

## Stylesheets

CSS is **not** one bundle. Every page links `assets/css/core.css` — tokens, reset,
header, footer — plus one bundle per section, named by the page's `stylesheets` front
matter and resolved in `_layouts/base.html`:

| Bundle | Pages |
|---|---|
| `home` | `/`, `/viewers/`, the 7 `/styles/:slug/` and 59 `/languages/:code/` pages |
| `docs` | `/docs/**` and the `_docs` collection |
| `docs-schema` | `/docs/schema/` only, on top of `docs` |
| `about` · `osm2vt` · `error` | `/about/`, `/osm2vectortiles/`, `404`/`500` |

Three rules when editing `_sass/`:

- **`_sass/vendor/` is not ours** — Tailwind's preflight, the `prose` rules and Prism's
  palette, carried over verbatim. Nothing to regenerate from and no upstream to pull.
- **`_tokens.scss` emits CSS, so it belongs to `core.scss` alone.** Mixins go in
  `_config.scss`. `@use`-ing tokens from a second entry point ships `:root` twice.
- **Each bundle ends with `element-overrides`**, which must load after the components
  it outranks. Adding a partial after it breaks that.

`script/verify-build` resolves every stylesheet href on every page, because a page
whose bundle failed to build renders unstyled with exit 0.

## Documentation

| | |
|---|---|
| `DEPLOYMENT.md` | build, configuration, generated output, rollback, troubleshooting |
| `CUTOVER.md` | what was verified about production, what keeps the legacy URLs working, and the order a cutover has to happen in |
| `THIRD-PARTY-NOTICES.md` | licences for the vendored libraries |

All three are in `_config.yml`'s `exclude:` and asserted out of the build — they are not
site content.
