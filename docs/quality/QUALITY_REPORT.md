# Quality Report

Phase 5 integration, optimisation and quality assurance for the dataset of `XRPLF/rippled@develop` at commit `c2534ff9c84422e00711da31629a76f3f59feb98`.

## Performance

Measured with `scripts/quality/measure-performance.js` against the production build (`npm run build && npm run preview`). Chromium runs with a 1440×900 viewport and 4× CPU throttling, and each figure is the median of three samples. The raw results are in [performance-before.json](performance-before.json) and [performance-after.json](performance-after.json).

```bash
node scripts/quality/measure-performance.js docs/quality/performance-after.json
```

### Bundle (gzip)

| Asset            | Before   | After    |
| ---------------- | -------- | -------- |
| JavaScript total | 143.2 KB | 126.7 KB |
| CSS total        | 6.4 KB   | 6.5 KB   |

### Pages

| Page                 | Load (ms)   | Blocking time (ms) | Longest task (ms) | JS heap (MB) | DOM nodes |
| -------------------- | ----------- | ------------------ | ----------------- | ------------ | --------- |
| Overview             | 1137 → 1101 | 157 → 105          | 129 → 93          | 20.4 → 13.8  | 278       |
| Namespace `xrpl`     | 1085 → 1107 | 255 → 219          | 171 → 161         | 24.1 → 20.3  | 13,024    |
| Class `STObject`     | 1398 → 1344 | 208 → 156          | 172 → 137         | 22.1 → 24.2  | 4,774     |
| Class `ApplyContext` | 1248 → 1210 | 186 → 158          | 163 → 141         | 19.2 → 18.0  | 4,144     |
| Search page          | 1150 → 1163 | 205 → 196          | 168 → 176         | 23.0 → 22.0  | 792       |

Search suggestions take 18–90 ms under 4× throttling, and navigating from the sidebar takes about 250 ms. Both vary by roughly ±30 ms between runs, which is within measurement noise.

### Optimisations kept

Together, these changes produced the before and after figures above:

- The search engine is built on first use (`createLazySearchEngine`), not at startup.
- The contract and pipeline schemas use `zod/mini`, the tree-shakable build of Zod.
- Production sourcemaps are disabled.

### Optimisations reverted

Each was measured and removed because it gave no measurable benefit:

- memoising the namespace tree nodes;
- `content-visibility: auto` on long member tables.

### Budgets enforced by tests

| Budget                             | Limit  | Test                                       |
| ---------------------------------- | ------ | ------------------------------------------ |
| JavaScript total (gzip)            | 140 KB | `tests/e2e/performance.spec.js`            |
| Largest JavaScript chunk (gzip)    | 95 KB  | `tests/e2e/performance.spec.js`            |
| CSS total (gzip)                   | 10 KB  | `tests/e2e/performance.spec.js`            |
| Longest task on the `xrpl` page    | 400 ms | `tests/e2e/performance.spec.js`            |
| Search suggestion response         | 500 ms | `tests/e2e/performance.spec.js`            |
| Search query over the full dataset | 50 ms  | `tests/integration/search-quality.test.js` |

## Accessibility

axe-core reports 0 violations under the WCAG 2.2 AA and best-practice rule sets. It covers the overview, class, method, enum, search results and both not-found pages, the open search suggestions, and the open navigation drawer, in both light and dark themes. It also covers the largest namespace page (`xrpl`). The audit runs in Chromium and Firefox at desktop, tablet and phone sizes (`tests/e2e/accessibility.spec.js`).

Fixes made:

- The subtle text colour was darkened to `#636c76` to meet the 4.5:1 contrast ratio.
- Decorative CSS glyphs moved to `data-glyph` attributes, so screen readers no longer announce them.
- Inline links are underlined.
- Landmarks are labelled.
- Not-found pages have a level-one heading.
- Search suggestions use `role="option"`.
- Touch targets on phones are at least 24×24 px.
- Closing the navigation drawer with Escape returns focus to the menu button.

Keyboard tests cover:

- the skip link;
- visible focus;
- operating the namespace tree;
- table headers;
- drawer focus return.

## Browsers and screen sizes

| Project            | Browser  | Viewport          | Result                    |
| ------------------ | -------- | ----------------- | ------------------------- |
| `desktop-chromium` | Chromium | Desktop           | Pass                      |
| `desktop-firefox`  | Firefox  | Desktop           | Pass                      |
| `tablet-chromium`  | Chromium | 820×1180, touch   | Pass                      |
| `mobile-chromium`  | Chromium | Pixel 7           | Pass                      |
| `github-pages`     | Chromium | Desktop, sub-path | Pass                      |
| `desktop-webkit`   | WebKit   | Desktop           | Not run (see limitations) |
| `mobile-webkit`    | WebKit   | iPhone 14         | Not run (see limitations) |

The latest run passed 234 tests and skipped 12. The skipped tests are intended: Firefox skips the Chromium-only performance checks, and wide-screen projects skip the tests for the narrow-screen drawer.

## Data integrity

`tests/integration/dataset-consistency.test.js` runs on the test fixture and on the published dataset. It checks that:

- every file comes from one pinned commit;
- the dataset passes schema and link integrity checks;
- every search row resolves to a record with the same name and kind;
- member and nested-type lists agree with each record's scope in both directions;
- inheritance is symmetric and matches `relationships.json` exactly;
- every overload has a distinct page under its overload set;
- documentation status is consistent: `present` only with content, `absent` only without, and `suppressed` only with a reason;
- every source location points at an existing line in the pinned source;
- documentation text comes from rippled. 4,775 of 4,815 checked summaries (99.2%) appear in the source file of the symbol, or of the member whose documentation it inherits.

Two dataset problems were found and fixed in the pipeline:

- **Incomplete derived-class lists.** Doxygen omits classes that derive from a template instantiation (for example `STTx` from `CountedObject<STTx>`) from the template's derived classes. 178 such edges were missing. The pipeline now adds the derived edge for every base-class edge, and inheritance is symmetric.
- **Unlabelled inherited documentation.** Doxygen's `INHERIT_DOCS` copies a base method's documentation onto an undocumented override. These 470 overrides are now labelled "Documentation inherited from …", with a link to the method that wrote the text. Overrides that repeat the base text in their own comment (37 in rippled) are not labelled.

## Deployment readiness

- `npm run build:pages` builds for `https://braedonklock.github.io/XRPL-Core-Reference/` into `dist-pages/`. It adds `404.html`, so direct links to deep pages still load, and `.nojekyll`.
- `tests/e2e/deployment.spec.js` serves that build the way GitHub Pages does. It checks direct navigation, refresh, assets and dataset under the sub-path, in-app links, malformed URLs, and that development-only files are not published.

## Known limitations

- **WebKit not tested locally.** WebKit needs system libraries (`sudo npx playwright install-deps`) that are not installed on the development machine. The WebKit projects are configured and run when `XCR_E2E_BROWSERS` includes `webkit`.
- **`xrpl::nft::kPageMask` is shown as a function.** It is a `constexpr UInt256` initialised with a non-literal argument (`std::string_view("…")`), which Doxygen parses as a function declaration. The existing correction only handles literal arguments, because a non-literal argument does not prove the record is a variable. Its declaration and source link are correct.
- The remaining Doxygen limitations are listed in [EXTRACTION_LIMITATIONS.md](../EXTRACTION_LIMITATIONS.md).
