# Architecture

XRPL Core Reference has two independently maintainable parts:

1. **The documentation extraction engine** (`scripts/documentation/`). It runs at build time, pins a rippled commit, runs Doxygen, and turns the output into a validated, versioned JSON dataset.
2. **The React documentation browser** (`src/`). It is a static single-page application that consumes only that dataset.

The two meet at one boundary: the data contract in `contract/`. The browser never reads Doxygen XML, and the engine knows nothing about the browser. The dataset can therefore serve other consumers too.

## Directory organisation

```
contract/                    Published data contract shared by the engine and the browser
  constants.js               Schema version, symbol kinds, dataset file names, search index columns
  schema.js                  Zod schemas for every published file
scripts/documentation/
  cli.js                     Command entry point (extract, build, generate, validate, fixtures)
  build-dataset.js           Orchestrates normalisation, resolution, generation and validation
  config/                    Doxygen pin, Doxyfile overlay, source categories, X-macro configuration
  extraction/                Git pinning, Doxygen installation and execution, extraction records, fixtures
  parsing/                   Order-preserving XML tree, Doxygen readers, warning log, source file reader
  normalization/             Doxygen XML to internal symbol model, corrections, exclusions
  resolution/                Signature keys, symbol URLs, collision detection, reference and scope resolution
  generation/                Declarations, public records, shards, search index, navigation, coverage, writer
  validation/                Dataset integrity, source-location verification, published-dataset validation
src/
  main.jsx                   Browser entry point: creates the dataset client and renders the app
  app/                       App, routes, root layout, dataset provider, not-found and error pages
  components/                Shared presentation: layout, navigation, feedback states, UI primitives
  features/
    navigation/              Namespace and class tree in the sidebar
    home/                    Overview page: revision, core types, namespaces, statistics
    search/                  Ranking engine, header search box, full results page with filters
    symbols/                 Reference pages: member tables, method pages, inheritance, clickable types
  services/documentation/    Dataset client, symbol directory, GitHub source links (no React)
  hooks/                     Dataset context, resource loading, theme
  config/                    Site settings and route helpers
  utils/                     Symbol kind labels, expression text
  styles/                    Design tokens and global styles
tests/
  fixtures/rippled-subset/   Real Doxygen output and source for 25 rippled source files and 5 X-macro files at the pinned commit
  helpers/                   Record builders, fixture dataset server, app renderer
  integration/               End-to-end pipeline tests
  e2e/                       Playwright tests against the full generated dataset
  setup/                     jsdom test setup
scripts/start-local.sh       One-command local start (`npm start`)
docs/                        Architecture, limitations, research records
```

Unit tests sit next to the modules they test (`*.test.js`).

## Pipeline

```
XRPLF/rippled develop
  │  extraction/git-repository.js     resolve develop (or --commit), verify ancestry, detached checkout, clean tree
  ▼
Pinned commit SHA
  │  extraction/doxygen-runner.js     Doxygen 1.17.0 (checksum-verified) + config/Doxyfile.overlay
  ▼
.cache/extractions/<sha>/             xml/, doxygen-warnings.log, source-revision.json
  │  normalization/build-source-model.js
  ▼
Internal symbols                      source-local IDs, token lists with refIds
  │  normalization/corrections/*      deterministic, tested fixes for known Doxygen deviations
  │  normalization/exclusions.js      categories, anonymous/phantom namespaces, macros, friend classes
  │  resolution/symbol-paths.js       deterministic URLs, collision detection (fatal)
  │  resolution/scope-references.js   links proven by C++ scope rules
  │  resolution/reference-resolution.js  refId → public path; unresolved → plain text
  ▼
Public records                        contract/schema.js
  │  generation/dataset-assembly.js   shards, search index, navigation, relationships
  │  validation/dataset-integrity.js  schemas, single SHA, unique paths, no broken links (fatal)
  ▼
public/data/<sha>/                    atomically written; current.json written last
```

## Source revision pinning

- `extract` resolves `origin/develop`, or verifies that `--commit` is reachable from it. It checks out the commit in detached mode, requires a clean tree, and re-checks `HEAD` after Doxygen finishes.
- The extraction directory is named after the full commit SHA. `build` refuses to run unless the source checkout is still at that SHA with no modifications. The fixture uses a hashed source snapshot for the same check.
- Every published file carries `schemaVersion` and `commitSha`. Integrity validation fails if any file disagrees.
- The writer stages the dataset, swaps it into `public/data/<sha>/`, deletes datasets for other commits, and then writes `public/data/current.json`. A deployment therefore never mixes revisions.
- `manifest.json` records the repository, branch, SHA, commit date, extraction and generation times, Doxygen version, configuration hash, generator version, input scope, and SHA-256 hashes of every top-level file.
- GitHub links are not stored per record. The browser builds them from `manifest.source` and each record's `location`: `https://github.com/XRPLF/rippled/blob/<sha>/<file>#L<line>`.

## Symbol identity and URLs

Doxygen IDs hash the declaration text. They are used only as join keys inside one build and never appear in published data.

- A compound's path comes from its scope chain, with one encoded segment per name: `xrpl/ApplyContext`, `std/hash%3Cxrpl%3A%3AAccountID%3E`.
- A member's path is its owner's path plus its name segment. Operators use readable names (`operator-equal`, `operator-call`, `operator-conversion-bool`), which keeps `/` out of every segment.
- A function has two paths:
  - its overload set, e.g. `xrpl/ApplyContext/view`, which stays valid as overloads are added or removed;
  - its individual overload, e.g. `xrpl/ApplyContext/view/8ca9df3f`, where the suffix is the first 8 hex digits of the SHA-256 of its signature key.
- The signature key covers the qualified name, normalised parameter types, `const` and reference qualifiers, and template parameters. For templates it also covers the return type and requires clause. Parameter names and default arguments are excluded, so renaming a parameter does not change a URL.
- Every symbol path and overload-set path is checked for uniqueness. A collision stops the build and prints every claimant.

## References and links

- **Type links** come only from Doxygen's structured `<ref refid>` elements, or from the scope rule below. Text matching is never used to create a link.
- **The scope rule** links an identifier to an enclosing class when C++ unqualified lookup is certain to find that class's injected class name. That means:
  - the name is not qualified;
  - no nearer class declares the name;
  - no template parameter in scope has the name;
  - no nearer class has a base class whose members are unknown.

  These links are marked `resolution: "scope"`.

- **Unresolved references** degrade to plain text, and their reasons are counted in the coverage report. Integrity validation guarantees that every published link target exists.
- **Enumerator links** target their enum's page with a fragment.

## Data organisation

| File                   | Purpose                                                                                                                        | Loaded                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `manifest.json`        | Revision, provenance, file hashes, counts                                                                                      | At startup                   |
| `search-index.json`    | One row per symbol or overload set: `[path, name, qualifiedName, kind, role, scope, category, brief, shard, overloads]`        | At startup (≈362 KB gzipped) |
| `navigation.json`      | Namespace and class tree, without members                                                                                      | At startup (≈14 KB gzipped)  |
| `symbols/<shard>.json` | Full records, one shard per class or namespace; large namespaces are split by first letter, and overloads always share a shard | On demand                    |
| `relationships.json`   | Inheritance edges, alias targets, friend relationships                                                                         | On demand                    |
| `coverage-report.json` | Coverage, corrections, unresolved items, warnings                                                                              | Diagnostics                  |

Shard file names are a hash of the shard key. The search index maps every row to its shard, so any path can be loaded with one request.

Records are designed for focused pages:

- each function carries a complete `declaration` token list, so the browser never assembles C++;
- each class lists its member paths in source order;
- descriptions are structured blocks (paragraphs, lists, code) with inline code, emphasis, URLs and links.

## Documentation browser

### Data flow

```
public/data/current.json ──► manifest.json ──► navigation.json + search-index.json   (startup, validated)
                                                         │
                                symbol directory: path → shard, name, kind, brief
                                                         │
                               symbols/<shard>.json   (on demand, validated, cached)
```

- `services/documentation/dataset-client.js` fetches every file and validates it against the shared Zod contract exactly once. It also checks that every file belongs to the commit in `current.json`, and caches each file by commit and shard. `current.json` is fetched with `no-cache`; everything else lives under a commit-specific path and can be cached indefinitely.
- `DatasetProvider` loads the startup files once and exposes the manifest, the navigation tree and the symbol directory through React context. Pages load their own shard with `useResource`, which ignores results that arrive after the user has moved on.
- Lint rules forbid code in `src/` from importing `scripts/` or Node built-ins. The browser depends only on `contract/` and the published files.

### Routing

- `/` is the overview page, and `/symbols/<path>` is a symbol page using the published path. Unknown routes get a not-found page.
- Symbol paths are read from `location.pathname`, not from route parameters. React Router decodes parameters, which would turn an encoded `%2F` inside a segment into a path separator. The raw pathname keeps the published encoding exactly.
- `/symbols/<overload set>` lists every overload, and `/symbols/<overload set>/<hash>` shows a single overload.
- The home and symbol pages are lazy-loaded route chunks. `ScrollRestoration` restores scroll positions on Back and Forward.

### Search

`features/search/services/search-engine.js` is a small, deterministic ranking engine over the search index (18,134 rows for the pinned commit). It is used instead of a general fuzzy-search library because C++ identifiers need exact, explainable ranking. Matches rank in tiers:

1. exact name, matching case;
2. exact name, ignoring case;
3. exact qualified name;
4. qualified-name suffix (`ApplyContext::view`);
5. name prefix;
6. camel-case or underscore word start (`Context` finds `ApplyContext`);
7. name substring;
8. qualified-name substring.

Ties go to types before members, then shorter names, then shorter qualified names, then alphabetical order. Queries containing `::` match qualified names. Results can be filtered by kind group and top-level namespace. Over the full dataset, each query takes a few milliseconds, so the engine runs on the main thread without a Web Worker. `tests/integration/search-quality.test.js` checks ranking for the specification's example queries and keeps queries under 50 ms.

The header search box follows the WAI-ARIA combobox pattern: `/` focuses it, arrow keys move through suggestions, Enter opens the selected suggestion or the full results page, and Escape closes it. `/search?q=&kind=&scope=` is a shareable results page with filters.

### Reference pages

`features/symbols/components/symbol-sections.jsx` builds the sections for each kind of symbol. The page renders them in order, and adds an "On this page" table of contents on wide screens when there are at least four sections.

| Kind                 | Sections                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class, struct, union | Description, declaration, template parameters, inheritance (base-class tree and derived classes), member tables (constructors and destructor, methods, static methods, operators, fields, type aliases, enums, friend functions, protected members, collapsed private members), nested types, friend classes, deduction guides, inherited members |
| Function overload    | Description, declaration, template parameters, parameters (type, default, description, direction), return value, explicit specializations, other overloads                                                                                                                                                                                        |
| Overload set         | Table of every overload                                                                                                                                                                                                                                                                                                                           |
| Variable             | Description, declaration, type, initial value                                                                                                                                                                                                                                                                                                     |
| Type alias           | Description, declaration, template parameters, aliased type                                                                                                                                                                                                                                                                                       |
| Enum                 | Description, declaration, enumerators with addressable rows (`#name`)                                                                                                                                                                                                                                                                             |
| Namespace            | Description, nested namespaces and classes, functions, variables, type aliases, enums                                                                                                                                                                                                                                                             |

- **Types are clickable everywhere they have a published target:** declarations, parameter and return types, field and alias types, default values and base classes. Anything without a target is plain text.
- **The inheritance tree** is built from `relationships.json`, which is loaded once and cached. Inherited members load the base class's shard only when that base is expanded.
- **Namespace member lists** come from the search index, so even the `xrpl` namespace renders without loading its member shards.
- **On narrow screens,** reference tables stack each row into name, type and description.

### Layout and design

The layout follows the navigation model of Revit API Docs: a dark header, a left namespace and class tree, and one readable content column (60 rem maximum). There is no permanent right-hand column. A table of contents will be added only to pages long enough to need one.

- Below 60 rem the sidebar becomes a drawer. It is opened from the header, closes on navigation, Escape or the backdrop, and receives focus when it opens.
- The tree renders a node's children only when it is expanded, because the `xrpl` namespace has over a thousand classes. The current page's ancestors expand automatically and the active row scrolls into view.
- Light and dark themes are defined as CSS custom properties in `styles/tokens.css`. An inline script in `index.html` applies the saved or system theme before first paint.
- Components use CSS Modules. Fonts are system fonts, so nothing is requested from third parties.
- Accessibility: a skip link, landmark roles, breadcrumbs with `aria-current`, labelled disclosure buttons with `aria-expanded`, visible focus outlines, and reduced-motion support.

## Source categories

`config/source-categories.js` maps repository paths to categories: `production` covers `include`, `src/libxrpl` and `src/xrpld`, and `test` covers `src/test`, `src/tests` and `src/benchmarks`. The selected categories set Doxygen's input and are recorded in the manifest. Every record and search row carries its category, so test symbols can be included and filtered later without schema changes.

## Testing

- Unit tests cover parsing, normalisation, every correction rule, exclusions, signature keys, URLs (including constructors, destructors, operators, conversions, templates, specialisations, overloads and collisions), scope and reference resolution, declarations, assembly, integrity and extraction support. The git pinning tests run against a temporary local repository.
- `tests/integration/rippled-subset-pipeline.test.js` runs the full pipeline over real Doxygen output for 25 rippled source files from the pinned commit. Every correction rule fires on real source in this fixture. The test asserts known facts, such as `ApplyContext::view() const` returning a link to `xrpl/ApplyView`, `STTx` being `final`, and the derived classes of `ReadView`. It also checks that generation is deterministic and that tampering is detected.
- `tests/integration/full-corpus.test.js` runs over the full local extraction when one exists, and skips otherwise.
- `npm run docs:fixtures` regenerates the fixture from the pinned checkout and strips machine-specific paths.
- **Browser unit and component tests** (Vitest with jsdom and React Testing Library) cover the dataset client, symbol directory, routes, source links, tree logic, the resource hook, feedback states, breadcrumbs, the theme toggle, the drawer and documentation rendering.
- `src/features/search/services/search-engine.test.js` covers ranking tiers, qualified queries, case, word starts, filters and limits. `src/features/symbols/utils/symbol-utils.test.js` covers member signatures, tags, grouping, inheritance trees (including cycles), breadcrumbs and initializer formatting.
- `src/app/ReferencePages.test.jsx` checks the real fixture's member tables, inheritance in both directions, lazy inherited members, parameter and return-type links, enumerator anchors, alias links, namespace members, and keyboard search from the header and the results page.
- `src/app/App.test.jsx` renders the whole app against a dataset that the real pipeline builds from the rippled fixture. It checks the overview, sidebar navigation, source links, overloads, encoded paths, not-found pages and data-loading errors.
- `tests/e2e/navigation.spec.js` (Playwright) runs the production build against the full generated dataset on a desktop and a mobile profile. It covers browsing, breadcrumbs, Back, deep links, encoded URLs, overloads, theme persistence and the mobile drawer.

## Decisions

| Decision                                             | Rationale                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Overlay the upstream Doxyfile instead of forking it  | Upstream changes to extraction flags flow through, and the overlay changes only what XML extraction needs.   |
| Targeted X-macro expansion                           | Recovers about 1,260 generated symbols without global expansion rewriting initialisers.                      |
| Zod at the generation boundary and in `validate`     | One validated contract; consumers need not re-validate trusted data.                                         |
| Plain JSON, sharded, without a prebuilt search index | Keeps the dataset reusable. The search implementation is a browser concern for Phase 4.                      |
| No caching of Doxygen output between commits         | Extraction takes about 4 seconds; CI caching is a Phase 6 concern.                                           |
| No UI framework or global state library              | The browser needs one context (the dataset) and a few components; CSS Modules and tokens are enough.         |
| Custom search ranking instead of MiniSearch          | Exact and qualified C++ name matches must rank deterministically first; a linear scan is a few milliseconds. |
| `useResource` instead of a data-fetching library     | Loading is a small number of immutable, cached files; a race-safe hook covers it.                            |
| Raw pathname for symbol routes                       | Preserves the published percent-encoding that route parameters would decode.                                 |
| Ship rippled's ISC licence inside every dataset      | Datasets contain rippled documentation comments, so the licence travels with them.                           |
