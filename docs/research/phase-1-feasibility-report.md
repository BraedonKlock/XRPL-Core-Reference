# XRPL Core Reference — Phase 1 Feasibility Report

Status: approved. This is the historical Phase 1 record. The prototype it describes (`research/phase-1/`) was replaced in Phase 2 by the pipeline in `scripts/documentation/`; current figures are in each dataset's `coverage-report.json`.

Every figure here was measured on the pinned commit below by `prototype-extract.mjs`. The prototype's full output is no longer kept in the repository.

## 1. Summary of findings

- **Doxygen XML is a viable primary source.** It extracts 1,399 compounds and 19,033 members from `include/`, `src/libxrpl` and `src/xrpld` in about 4 seconds. The Node parser loads the entire XML corpus in about 1.5 seconds.
- **Type navigation can be fully structured.** Doxygen emits `<ref refid>` links inside return types, parameter types, default values, initialisers, alias targets and template arguments. All 21,213 such links resolve to an extracted symbol, and none are dangling. No text matching is needed for any link we emit.
- **Upstream's Doxyfile cannot be used as-is.** It sets `GENERATE_XML = NO` and `FULL_PATH_NAMES = NO`, which loses directories in source paths. It points `INCLUDE_PATH` only at `src/`, while the public headers now live in `include/`. It also downloads a cppreference tag file at build time. We layer a small overlay on top of it instead of forking it.
- **X-macro-generated symbols are invisible unless expanded deliberately.** Expanding the 12 X-macro definers in a targeted way recovers 347 `sf*` fields, 52 active and 62 retired amendment constants, 29 `LedgerEntryType` enumerators and 774 `jss::` names. It also eliminates 639 garbage `JSS()` pseudo-functions, and changes no other signature.
- **Doxygen's own IDs work as join keys, but not as public URLs.** They are md5 hashes of the declaration text, so they change whenever a signature, an attribute macro or the config changes. They are deterministic for a fixed commit and config.
- **About 5% of records need explicit, rule-based correction during normalisation.** Most of these are direct-initialised constants misparsed as functions. Every case found is enumerated in §6 with a deterministic rule.
- **31.8% of symbols carry any documentation comment.** The UI must treat undocumented as the normal state and must never invent descriptions.

## 2. Source revision

| Field                   | Value                                                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| Repository              | `XRPLF/rippled`                                                                 |
| Branch                  | `develop`                                                                       |
| Commit SHA              | `c2534ff9c84422e00711da31629a76f3f59feb98`                                      |
| Commit date             | 2026-11-25T15:23:34Z (`docs: Fix doxygen refs (#8774)`)                         |
| Doxygen                 | 1.17.0 (`65a43c0a`), the same version upstream's CI pins via `nix/packages.nix` |
| Doxygen archive SHA-256 | `75419ef4f446fc1c24ef12514b574e66e898ee6f527c6ae2ad84f91a905823c2`              |

The extraction script checks out the SHA in detached mode. It fails if the commit is not an ancestor of `origin/develop`, if the tree is dirty, or if `HEAD` moves during extraction. It records all of the above in `source-revision.json`.

## 3. Upstream Doxygen configuration (investigated)

- Location: `docs/Doxyfile`. It is driven by `cmake/XrplDocs.cmake`, which defines the `docs` target with `-Donly_docs=ON`, and published by `.github/workflows/publish-docs.yml` to GitHub Pages as HTML only.
- Relevant upstream values, and what we verified about each:

| Setting                                              | Upstream              | Verified behaviour / our choice                                                                                                                                                                                    |
| ---------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GENERATE_XML`                                       | `NO`                  | Must be `YES`.                                                                                                                                                                                                     |
| `EXTRACT_ALL` / `EXTRACT_PRIVATE` / `EXTRACT_STATIC` | `YES`                 | Kept. Undocumented, private and static members all appear (`ApplyContext` has 5 private fields).                                                                                                                   |
| `EXTRACT_ANON_NSPACES`                               | `NO`                  | Kept. Anonymous namespaces still appear as empty `@<hash>` compounds, which normalisation filters (48 records).                                                                                                    |
| `FULL_PATH_NAMES` / `STRIP_FROM_PATH`                | `NO` / `src/`         | Changed to `YES` / repo root, so locations come out as `include/xrpl/tx/ApplyContext.h`.                                                                                                                           |
| `INCLUDE_PATH`                                       | `src`                 | Changed to `include src`. This is required to resolve `#include <xrpl/...>` and the `.macro` files.                                                                                                                |
| `SOURCE_BROWSER`                                     | `YES`                 | Set to `NO`. `bodyfile` / `bodystart` / `bodyend` are emitted in XML regardless, so we lose nothing.                                                                                                               |
| `REFERENCES_RELATION` / `REFERENCED_BY_RELATION`     | `NO`                  | Verified: `YES` adds `<references>` / `<referencedby>` call edges, but grows the XML from 47 MB to 170 MB. Kept `NO` for now; it is the data source for future call graphs.                                        |
| `INLINE_INHERITED_MEMB`                              | `YES`                 | Set to `NO` so that each member is defined once; inherited members are computed from the inheritance graph instead.                                                                                                |
| `BUILTIN_STL_SUPPORT`                                | `YES`                 | Kept, because it lets inheritance from `std::` types parse. Side effect: dangling `innerclass` refs to `std::allocator` and similar stubs with no compound file. The resolver treats unknown refids as unresolved. |
| `MACRO_EXPANSION` / `EXPAND_ONLY_PREDEF`             | `YES` / `YES`         | Kept, plus a targeted `EXPAND_AS_DEFINED` list (§4). Global expansion (`EXPAND_ONLY_PREDEF = NO`) was tested and rejected: it rewrites source text in initialisers, e.g. `QUALITY_ONE` becomes `1 '000 '000 '000`. |
| `TAGFILES`                                           | cppreference download | Removed. Network-dependent, and only relevant to HTML output.                                                                                                                                                      |
| `CLANG_ASSISTED_PARSING`                             | `NO`                  | The 1.17.0 release binary does link libclang, but it needs a `compile_commands.json` from a full Conan/CMake configure. Deferred (§9).                                                                             |

## 4. Recommended extraction approach

Use Doxygen 1.17.0 XML, configured by [`scripts/documentation/config/Doxyfile.overlay`](../../scripts/documentation/config/Doxyfile.overlay). The overlay `@INCLUDE`s upstream's `docs/Doxyfile`, so upstream changes to extraction flags and `PREDEFINED` flow through automatically. It then overrides only:

- the input scope: `include`, `src/libxrpl` and `src/xrpld`, with patterns `*.h *.hpp *.ipp *.cpp`;
- path handling and include resolution;
- the output format: XML only, no graphs or HTML;
- targeted expansion of the X-macro definers: `EXPAND JSS TYPED_SFIELD UNTYPED_SFIELD XRPL_FEATURE XRPL_FIX XRPL_RETIRE_FEATURE XRPL_RETIRE_FIX LEDGER_ENTRY LEDGER_ENTRY_DUPLICATE TRANSACTION GRANULAR_PERMISSION`, with `INCLUDE_FILE_PATTERNS = *.macro`;
- `XRPL_NO_SANITIZE_ADDRESS` defined as empty, so it no longer leaks into return types.

Effect of the targeted expansion, compared with the baseline overlay, measured by diffing all memberdefs:

- 0 surviving members changed signature;
- 1,584 records were added, including the 774 `jss::` names;
- 646 records were removed: 639 bogus `JSS()` pseudo-functions, 5 other macro-misparse artifacts, and `Throw` / `rethrow`, which were re-identified because their attribute macro disappeared;
- the net gain is 938 member records, plus enumerators.

Test, benchmark and fixture code is excluded: `src/test`, `src/tests` and `src/benchmarks`, 640 files. These are not part of the core implementation, and they would add many name collisions, for example test classes that shadow production names. This is a one-line change if contributors want the `jtx` test framework documented.

## 5. Real examples (from `output/sample/`)

**`xrpl::ApplyContext`**: `include/xrpl/tx/ApplyContext.h:27`, body at lines 28–160. Brief: _"State information when applying a tx."_ It has 16 public functions, 5 public fields and 5 private fields.

The const overload of `view()` shows how the clickable return type is represented:

```json
{
  "name": "view",
  "returnType": [
    { "text": "ApplyView", "refid": "classxrpl_1_1ApplyView", "refKind": "compound" },
    { "text": " const &" }
  ],
  "qualifiers": { "isConst": true, "isNodiscard": true },
  "location": {
    "declaration": { "file": "include/xrpl/tx/ApplyContext.h", "line": 74 },
    "definition": { "file": "include/xrpl/tx/ApplyContext.h", "line": 74, "endLine": 77 }
  }
}
```

Its primary constructor links to a declaration in the header and a definition in a separate `.cpp`, which is captured for 3,740 functions. Two of its parameters, with links nested inside a template argument:

```json
{ "name": "parentBatchId",
  "type": [ { "text": "std::optional< " },
            { "text": "UInt256", "refid": "namespacexrpl_1a828887c5b310e7be87ca398a23c99874", "refKind": "member" },
            { "text": " const > const &" } ] },
{ "name": "tx", "type": [ { "text": "STTx", "refid": "classxrpl_1_1STTx", "refKind": "compound" }, { "text": " const &" } ] }
```

Declared at `ApplyContext.h:30`, defined at `src/libxrpl/tx/ApplyContext.cpp:22-44`. Deleted copy and move constructors are recognised from the `=delete` suffix (`isDeleted`).

**`xrpl::STTx`**: `final`. Base classes are `xrpl::STObject` and `xrpl::CountedObject< STTx >`, both resolved. This matches the source line `class STTx final : public STObject, public CountedObject<STTx>`.

**`xrpl::ReadView`**: `isAbstract: true` with 14 pure-virtual members. Derived classes are `ApplyView`, `DigestAwareReadView` and `OpenView`. `read()` returns `SLE::const_pointer`, which links to the member typedef `STLedgerEntry::const_pointer`. It is documented with brief _"Return the state item associated with a key."_ and `@return` _"nullptr if the key is not present or if the type does not match."_

**`xrpl::SHAMap`**: 49 public, 35 private, 1 public static and 1 private static functions, plus 3 nested types. The snapshot constructor shows per-parameter `@param` extraction: `other` is _"The map to snapshot. An Invalid source yields an Invalid snapshot."_, and `isMutable` is _"Whether the snapshot may be modified. Ignored when other is Invalid."_

**`xrpl::TER`**: `using xrpl::TER = TERSubset<CanCvtToTER>`. The alias target is tokenised with both template-name and argument links, so "click through an alias" is structured data.

**Navigation hop.** The public members of `ApplyContext` reference 17 distinct resolvable targets, all of which are in `output/sample/symbol-index.json`. `relationships.json` has 276 resolved type-reference edges and 16 alias edges, and 0 unresolved.

## 6. Documentation coverage

| Metric                                                        | Value                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Namespaces (non-anonymous, with a real location)              | 76                                                                                                                        |
| Classes / structs / unions / concepts                         | 929 / 360 / 1 / 33                                                                                                        |
| Template classes / explicit specialisations                   | 265 / 63                                                                                                                  |
| Methods, excluding ctors, dtors, operators and static methods | 6,907                                                                                                                     |
| Constructors / destructors / operators / static methods       | 1,785 / 222 / 647 / 553                                                                                                   |
| Free functions                                                | 3,070 (823 of all functions are templates)                                                                                |
| Member variables / namespace variables                        | 3,635 / 943                                                                                                               |
| Type aliases (`using`) / typedefs                             | 924 / 5                                                                                                                   |
| Enums / enumerators                                           | 144 / 1,083                                                                                                               |
| Symbols with any doc comment                                  | 6,506 of 20,432 (31.8%)                                                                                                   |
| Classes documented                                            | 541 / 929 (58%)                                                                                                           |
| Methods documented                                            | 3,780 / 6,907 (55%)                                                                                                       |
| Type aliases documented                                       | 37 / 924 (4%)                                                                                                             |
| Parameters with a `@param` description                        | 3,695 of 17,783 (3,280 parameters are unnamed)                                                                            |
| Structured type references: resolved / dangling               | 21,213 / 0                                                                                                                |
| Inheritance edges: resolved / external or unresolved          | 573 / 167                                                                                                                 |
| Functions sharing a qualified name with another (overloads)   | 2,862 across 1,024 names                                                                                                  |
| Overload signature-key collisions                             | 1 (§7)                                                                                                                    |
| Duplicate Doxygen IDs                                         | 15 (each is the same template member emitted for its in-class declaration and its out-of-class definition; safe to merge) |
| Declared locations verified against source: exact line        | 19,226 / 20,356 (94.4%)                                                                                                   |
| Within ±1 line / ±3 lines / name not found                    | 861 / 32 / 237                                                                                                            |
| Doxygen warnings                                              | 240, mostly upstream `@param` mismatches                                                                                  |

Search targets in the pinned commit, by exact name:

| Name                                                | Matches                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `STTx`, `ApplyContext`, `ReadView`, `SHAMap`, `TER` | 1 type each                                                                                               |
| `Payment`                                           | 2 classes: `xrpl::Payment` (the transactor) and `xrpl::transactions::Payment` (the autogenerated builder) |
| `preflight`                                         | 77 functions                                                                                              |
| `preclaim`                                          | 72 functions                                                                                              |
| `doApply`                                           | 78 functions                                                                                              |

Ranking must therefore show the owner or namespace, and should prefer types over same-named constructors.

## 7. Identified limitations

All of these were observed on this commit, not assumed. "Mitigation" describes what Phase 2 will do.

| #   | Limitation                                                                                                                                                                                                                 | Scale                                                                                           | Mitigation                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **Most vexing parse.** Direct-initialised constants become `function` records. Examples: `constexpr StaticString Account("Account")` and `Charge const kFeeInvalidData(...)` in `.cpp` files.                              | All 774 `jss::` names; 366 names have both a variable record and a bogus function record.       | Deterministic rule: a "parameter" whose type is a literal and that has no declarator name is an initialiser, so reclassify the record as a variable. Merge a bogus function record into the variable of the same qualified name as its definition location. Report counts. |
| L2  | **Macro-sourced line numbers.** Symbols from `sfields.macro` and `features.macro` are reported one line late. The `TRANSACTION`/`LEDGER_ENTRY` → `JSS` expansions in `jss.h` get unrelated lines inside the `.macro` file. | 695 records off by one; about 245 wrong.                                                        | Verify every location against the source (as the prototype already does). Correct only an unambiguous ±1 match on the expected name. Otherwise point to the macro invocation file without a line and flag it. Never emit a wrong line.                                     |
| L3  | **Upstream comment-markup errors corrupt attribution.** An unbalanced backtick at `Validations.h:508` merges the docs of `current()` into `byLedger()`.                                                                    | 2 files, listed in the warning log under "still inside a (nested) comment".                     | Parse the warning log. Mark documentation from affected ranges as `unreliable` and suppress it rather than show it attached to the wrong symbol. Worth an upstream PR.                                                                                                     |
| L4  | **A trailing `requires` after a trailing return type** is sometimes folded into the return type, e.g. `std::pair< iterator, bool > requires(!MaybeMulti)`.                                                                 | Seen in the `beast` aged containers.                                                            | Detect a `requires` suffix in return tokens and move it to `requiresClause`. Include return type and requires clause in overload identity: collisions fell from 41 to 1.                                                                                                   |
| L5  | **Explicit member specialisations defined in `.cpp`** are folded onto the primary template.                                                                                                                                | 5 `STInteger<T>::STInteger(SerialIter&, SField const&)` definitions share one record.           | Document the limitation. Show the declaration only, and do not present one of the definition lines as "the" definition.                                                                                                                                                    |
| L6  | **No link from injected class names and some nested names.** For example, `AbstractClock const &` inside `AbstractClock`, or `Input` inside RPC handlers.                                                                  | 705 unlinked mentions of uniquely named project types, against 21,213 linked.                   | Phase 2 baseline: leave these as plain text. Optional rule: link only the injected class name, which C++ scoping guarantees refers to the enclosing class, marked `resolution: "scope"`.                                                                                   |
| L7  | **Base classes reached through alias templates are unresolved.** For example, `HandlerFor<Input>` via `using HandlerFor = ::rpc::spec::HandlerFor<...>`.                                                                   | Part of 167 unresolved bases; the rest are genuinely external (`std::exception`, `boost::...`). | Show them as plain text, as the spec requires.                                                                                                                                                                                                                             |
| L8  | **Phantom namespaces from out-of-line definitions** such as `ReadView::SlesType::begin()`, at location `[generated]`. Anonymous namespaces appear as `@<hash>`.                                                            | 14 + 48 records.                                                                                | Filter them, and count them in the coverage report.                                                                                                                                                                                                                        |
| L9  | **Friend declarations** produce member records with misleading qualified names, such as `xrpl::SHAMap::ConstIterator::SHAMap`.                                                                                             | 198.                                                                                            | Model friends as relationships, not symbols. Exclude them from search.                                                                                                                                                                                                     |
| L10 | **No semantic C++ analysis.** Doxygen's parser is heuristic: there is no overload resolution and no instantiation.                                                                                                         | —                                                                                               | Clang-assisted parsing (§9) is the upgrade path if fidelity needs to rise further.                                                                                                                                                                                         |
| L11 | **Doc comments embedded in `.macro` files can attach to the wrong enumerator.** The `transactions.macro` header comment became the brief for `ttPAYMENT`.                                                                  | Isolated.                                                                                       | Suppress briefs on records whose location is a `.macro` file unless the comment is adjacent to the invocation.                                                                                                                                                             |

## 8. Recommended documentation data architecture

**Identity**

- `id` is the Doxygen refid. It is used only as a join key inside one dataset, and never as a URL.
- `key` is the stable public identity:
  - compounds, variables, aliases and enums use the qualified name, with template-aware splitting (`std::hash< xrpl::AccountID >` must not be split inside `<>`);
  - functions use the qualified name plus a normalised signature key: template params, parameter types, cv- and ref-qualifiers, plus return type and requires clause for templates.
- URLs are `/symbols/xrpl/ApplyContext`. An overload set is `/symbols/xrpl/ApplyContext/view`, and an individual overload is `/symbols/xrpl/ApplyContext/view/<8-hex hash of key>`. The overload-set page stays valid when overloads are added or removed.

**Records** (JavaScript schemas validated with Zod at the generation boundary, and versioned with `schemaVersion`):

- `Symbol`: the common fields `id`, `key`, `kind`, `name`, `qualifiedName`, `scope`, `brief`, `description`, `notes` and `location { declaration, definition }`. Specialised records add:
  - `Compound`: bases, derived classes and inner compounds;
  - `Function`: role, return type, parameters, qualifiers, template parameters and requires clause;
  - `Variable` / `Alias`: type and initialiser;
  - `Enum`: whether it is scoped, the underlying type and enumerators.
- `TypeExpression` is an ordered `[{ text, ref? }]` token list, where `ref` is a `{ targetId, resolution: "doxygen" | "scope" }`. The UI renders text and links, and never parses C++.
- `SourceLocation` is `{ file, line, endLine? }` (repo-relative). GitHub URLs are built in a frontend service from `manifest.commitSha`, giving `https://github.com/XRPLF/rippled/blob/<sha>/<file>#L<line>`, and are never stored per record.

**Output layout**: one directory per dataset, so revisions can never mix.

```
public/data/<commitSha>/
  manifest.json          repository, branch, SHA, extractedAt, doxygenVersion, schemaVersion, counts, file hashes
  search-index.json      [key, name, qualifiedName, kind, owner, brief≤100]; 20,234 rows ≈ 250 KB gzip
  navigation.json        namespace → compound tree, without members
  symbols/<shard>.json   one per compound; namespace members sharded by source file
  relationships.json     inheritance graph and alias targets; reverse "used by" edges later
  coverage-report.json
```

Sharding is required. Namespace `xrpl` alone serialises to 3.9 MB, while the median compound is 9.5 KB.

## 9. Recommended project architecture (pipeline)

The pipeline goes under `scripts/documentation/`, with one module per responsibility:

- `config/`: the overlay plus pipeline constants.
- `extraction/`: repository acquisition, SHA pinning and verification, the Doxygen install with checksum, and the Doxygen run. This ports `run-extraction.sh` to Node.
- `parsing/`: an XML tree, plus readers for index, compounds and members. This uses `fast-xml-parser` with `preserveOrder`, because mixed content in `<type>` must keep its order.
- `normalization/`: records, type tokens, documentation and the correction rules L1–L4, L8, L9 and L11. Each rule is a named, unit-tested function that reports how often it fired.
- `resolution/`: refid resolution, the overload signature key and inheritance closure.
- `validation/`: Zod schemas, location verification against source, and dataset integrity. This covers a single SHA, unique keys, no dangling links, and failing the build on critical errors.
- `generation/`: sharded JSON, the search index, the manifest and the coverage report.

The React app depends only on the generated JSON contract, never on this code.

Clang-assisted parsing is the upgrade path if L1, L4 and L5 need to be fixed at the source rather than corrected. It requires a `compile_commands.json` from rippled's Conan/CMake configure, which is minutes of setup in CI rather than seconds. I recommend re-evaluating it after Phase 2 against the correction-rule counts.

## 10. Commands to reproduce

The Phase 1 prototype commands have been retired. To reproduce the extraction with the Phase 2 pipeline, run `npm run docs:generate -- --commit c2534ff9c84422e00711da31629a76f3f59feb98` (see the README).

## 11. Proposed Phase 2 implementation plan

1. Create the root `package.json`, ESLint, Prettier and Vitest, needed for testing the pipeline. Port the prototype modules into `scripts/documentation/` according to §9, and delete `research/phase-1/lib`.
2. Define Zod schemas (`schemaVersion` 1.0.0) for `manifest`, `Symbol` variants, `TypeExpression`, `SourceLocation`, search rows and relationships.
3. Implement the normalisation correction rules L1–L4, L8, L9 and L11, each with fixture-based unit tests. Fixtures are XML snippets copied from this commit's Doxygen output, with their source SHA recorded.
4. Implement resolution: refid resolution, signature keys with a collision check that fails the build, inheritance closure, and optional injected-class-name links.
5. Implement validation: location verification against source with ±1 correction, the single-SHA check, no duplicate keys, no dangling refs, and schema validation. Critical errors exit non-zero; everything else goes to the coverage report.
6. Implement generation: the sharded layout of §8, the compact search index and the manifest.
7. Add integration tests that run the whole pipeline over a small real subset (`ApplyContext.h`, `STTx.h`, `ReadView.h`, `SHAMap.h`, `TER.h`, plus the `.macro` files). Assert known facts, such as STTx's bases, ReadView's derived classes, and `view()` returning a link to `ApplyView`.

## 12. Decisions for review

1. Exclude `src/test`, `src/tests` and `src/benchmarks` (recommended), or include the `jtx` test framework.
2. Enable the injected-class-name scope rule (L6), or emit Doxygen links only.
3. Defer Clang-assisted parsing until after Phase 2 (recommended).
4. Defer the reference relations (call graphs, +123 MB of XML) to a future feature (recommended).
