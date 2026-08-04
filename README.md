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
| `port-jekyll-rewrite` | the Jekyll rewrite under review, and the branch the port PR comes from | [labs.maptiler.com/www.openmaptiles.org](https://labs.maptiler.com/www.openmaptiles.org/) |

This is a fork. Production is `openmaptiles/www.openmaptiles.org`, and no port PR has
been opened against it yet. `master` is kept identical to upstream so that stays a
single tree replacement rather than a diverged merge.

## Before changing anything

Two things are load-bearing and easy to break silently:

- **Pages Source must be "GitHub Actions."** The built-in Pages build runs Jekyll in
  `--safe` mode, which skips `_plugins/` and *exits 0* — measured, 88 HTML files instead
  of 153, with no error. `datapage_generator.rb` alone produces 66 of those pages from
  `_data/`.
- **Nothing publishes unless `script/verify-build` passes.** It asserts the route floor,
  one check per custom plugin, the generated assets, and all 39 legacy redirects in
  `script/redirects.tsv`. Adding a redirect without adding it there means nothing
  checks it.

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

- **`_sass/vendor/` is not ours.** Tailwind's preflight, the `@tailwindcss/typography`
  prose rules and Prism's `oneLight` palette, all carried over verbatim from the
  previous build's compiled output. The script that produced them is gone, so there is
  nothing to regenerate from and no upstream to pull — but they are also not design
  decisions. Read them to understand a computed value; change them only deliberately.
- **`_tokens.scss` emits CSS and belongs to `core.scss` alone.** Mixins and Sass-only
  values go in `_config.scss`, which is free to `@use` anywhere. `@use`-ing tokens from
  a second entry point ships the whole `:root` block twice.
- **Each bundle ends with `element-overrides`**, which has to load after the components
  it outranks. Adding a partial after it in an entry point breaks that.

A page whose bundle fails to build renders unstyled with exit 0 — `script/verify-build`
resolves every stylesheet href on every page to catch it.

## Documentation

| | |
|---|---|
| `DEPLOYMENT.md` | build, configuration, generated output, rollback, troubleshooting |
| `CUTOVER.md` | what was verified about production, what keeps the legacy URLs working, and the order a cutover has to happen in |
| `THIRD-PARTY-NOTICES.md` | licences for the vendored libraries |

All three are in `_config.yml`'s `exclude:` and asserted out of the build — they are
not site content.
