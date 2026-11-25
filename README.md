# XRPL Core Reference

Explore the XRP Ledger's C++ Core.

XRPL Core Reference is a searchable, navigable reference for the C++ implementation of the XRP Ledger in [XRPLF/rippled](https://github.com/XRPLF/rippled). It documents the internal classes, functions, types and relationships on the `develop` branch for developers contributing to rippled. It is not documentation for the public JSON-RPC or WebSocket APIs.

This is a community-maintained project. It is not affiliated with or endorsed by the XRPL Foundation or Ripple.

## Status

The website runs locally with global search, namespace and class navigation, class pages with member tables and inheritance, dedicated method pages, clickable types, and links to the exact source lines.

| Phase | Scope                             | State                                                            |
| ----- | --------------------------------- | ---------------------------------------------------------------- |
| 1     | Research and feasibility          | Complete ([report](docs/research/phase-1-feasibility-report.md)) |
| 2     | Documentation extraction pipeline | Complete                                                         |
| 3     | React foundation                  | Complete                                                         |
| 4     | Core reference features           | Complete, awaiting review                                        |
| 5     | Integration and optimisation      | Not started                                                      |
| 6     | Deployment                        | Not started                                                      |

## What the pipeline produces

Each dataset documents exactly one `develop` commit. For commit `c2534ff9c84422e00711da31629a76f3f59feb98` it contains:

- 19,990 symbols: 76 namespaces, 929 classes, 360 structs, 31 concepts, 10,308 function overload sets, 5,356 variables, 929 type aliases, and 144 enums with 1,083 enumerators;
- 47,377 resolved type and documentation links, with 0 broken internal links and 0 URL collisions;
- source locations verified against the source, 98.8% on the exact line;
- a coverage report covering documentation coverage, every correction applied, and every unresolved item.

Known Doxygen limitations, and how each one is handled, are in [docs/EXTRACTION_LIMITATIONS.md](docs/EXTRACTION_LIMITATIONS.md). The design is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Running the website locally

```bash
npm start
```

`npm start` installs dependencies and generates the documentation dataset if either is missing. It then opens the site at http://localhost:5173. To do these steps yourself:

```bash
npm install
npm run docs:generate
npm run dev
```

To try the optimised production build, run `npm run build && npm run preview` and open http://localhost:4173.

## Prerequisites

- Node.js 22 or later
- git
- Linux x86-64 for documentation extraction. Doxygen 1.17.0 is downloaded automatically and verified by SHA-256.

## Generating documentation

```bash
npm run docs:generate
npm run docs:generate -- --commit <full develop commit SHA>
npm run docs:build
npm run docs:validate
```

| Command         | Effect                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs:generate` | Clones or fetches rippled into `.cache/rippled`, pins the commit, runs Doxygen, and builds the dataset into `public/data/<sha>/`. Without `--commit` it pins the current tip of `develop`. |
| `docs:extract`  | Runs only the pinning and Doxygen steps.                                                                                                                                                   |
| `docs:build`    | Rebuilds the dataset from an existing extraction. The checkout must still be at the extracted commit.                                                                                      |
| `docs:validate` | Re-checks a published dataset: hashes, schemas, single-revision consistency, and links.                                                                                                    |
| `docs:fixtures` | Regenerates the test fixture from the pinned checkout.                                                                                                                                     |

Pass `--categories production,test` to include rippled's test code as a separate category.

## Development commands

| Command                                   | Effect                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                             | Development server with hot reload                                                                                       |
| `npm run build`                           | Production build into `dist/`, including the dataset in `public/data/`                                                   |
| `npm run preview`                         | Serve the production build                                                                                               |
| `npm run lint`                            | ESLint, including the no-comments and browser/pipeline boundary rules                                                    |
| `npm run format` / `npm run format:check` | Prettier                                                                                                                 |
| `npm test`                                | Pipeline, contract and browser tests (Vitest)                                                                            |
| `npm run test:e2e`                        | Playwright tests against the production build. Run `npx playwright install chromium` once, and generate a dataset first. |

## License

The original code in this repository is released under the [MIT License](LICENSE).

Generated datasets and the test fixture contain material from rippled, which remains under rippled's ISC License. Each dataset ships rippled's license as `rippled-license.txt`, and the fixture keeps it at `tests/fixtures/rippled-subset/source/LICENSE.md`. See [NOTICE.md](NOTICE.md).
