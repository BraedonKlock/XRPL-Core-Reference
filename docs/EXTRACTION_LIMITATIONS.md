# Extraction Limitations

XRPLD C++ Reference extracts rippled's C++ source code, including internal implementation details, with Doxygen 1.17.0. Doxygen parses C++ heuristically: it does not compile the code, resolve overloads, or instantiate templates. This document lists every known way the raw output deviates from the source, and what the pipeline does about each.

All figures are for `XRPLF/rippled@develop` at commit `c2534ff9c84422e00711da31629a76f3f59feb98`. Every dataset reports its own figures in `coverage-report.json` under `corrections`, `exclusions`, `references` and `sourceLocations`.

## Principles

- A correction is applied only when structured data, C++ language rules, or the source text itself proves the outcome. Nothing is guessed.
- Every correction is a named rule in `scripts/documentation/normalization/corrections/`. Each has unit tests and is also exercised against real rippled source in the integration fixture.
- Every corrected record lists the rule IDs in its `corrections` field.
- When a rule cannot verify its fix, the record is left unchanged or the doubtful detail is removed, and the case is listed under `unresolved` in the coverage report.
- Documentation is never invented. Documentation Doxygen attached to the wrong symbol is suppressed (`documentation.status = "suppressed"`) and the reason is published.

## Corrected deviations

| Rule                                          | Deviation                                                                                                                                 | Evidence required                                                                                                                                          | Applied           | Unresolved |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------- |
| `merge-duplicate-member-records`              | Template members declared in a class and defined outside it are emitted twice with one ID.                                                | Same ID, kind and qualified name.                                                                                                                          | 15                | 0          |
| `attach-deduction-guides`                     | Class template argument deduction guides (`ScopeExit(EF) -> ScopeExit<EF>`) appear as free functions named after the class.               | A class template with the same name in the same scope, and a trailing `-> Name<...>` result.                                                               | 4                 | 0          |
| `merge-misparsed-variable-definitions`        | Out-of-line direct-initialised definitions (`SField const sfInvalid(access, -1, "")`) also appear as function declarations.               | C++ forbids a function and a variable with the same name in one scope; the function record must also sit at the variable's declaration or definition line. | 366               | 0          |
| `reclassify-literal-initialized-constants`    | Direct-initialised constants with literal arguments (`constexpr StaticString Account("Account")`) appear as functions.                    | Every "parameter" is an unnamed literal, which no function declaration can have.                                                                           | 778               | 0          |
| `split-trailing-requires-clause`              | A trailing `requires` after a trailing return type is folded into the return type.                                                        | A top-level `requires` keyword in the return type, and no separate clause.                                                                                 | 24                | 0          |
| `merge-folded-explicit-specializations`       | Explicit member specialisations defined in `.cpp` files are folded onto the primary template, creating records with identical signatures. | Each definition line reads `Owner<args>::member` directly after `template <>`.                                                                             | 1 (5 definitions) | 0          |
| `correct-macro-location-lines`                | Symbols expanded from `.macro` files are reported after the invocation, not at it.                                                        | The reported line names the symbol, or the nearest preceding X-macro invocation names it and its parentheses close on the line just before the report.     | 537               | 56         |
| `suppress-macro-definer-documentation`        | A comment describing an X-macro (e.g. `TRANSACTION(tag, value, ...)`) becomes the brief of its first expansion (`ttPAYMENT`).             | The brief begins with a configured X-macro invocation.                                                                                                     | 3                 | 0          |
| `suppress-unterminated-comment-documentation` | An unterminated comment upstream (an unbalanced backtick at `Validations.h:508`) shifts documentation onto the wrong members.             | Doxygen's own "still inside a (nested) comment" warning, and the symbol declared at or after the reported start line.                                      | 20                | 0          |
| `remove-unverifiable-location-lines`          | Doxygen occasionally reports a line that does not contain the symbol, e.g. `operator<<` at `MPTAmount.h:135`.                             | The name is absent within ±3 lines; the line is removed and the file kept.                                                                                 | 0                 | 11         |

The 56 unresolved macro lines are `jss::` names generated through `TRANSACTION` and `LEDGER_ENTRY`. Doxygen's line counting inside those multi-line invocations that contain comments cannot be reconciled with the source, so these records keep the correct file without a line number.

## Completed relationships

- **Derived classes of templates.** Doxygen omits a class from a template's derived classes when the class derives from an instantiation of the template, such as `STTx` deriving from `CountedObject<STTx>`. `completeDerivedEdges` adds the derived edge for every structured base-class edge; 178 edges were added. Inheritance is therefore symmetric.
- **Inherited documentation.** With `INHERIT_DOCS`, Doxygen copies an overridden member's documentation onto an override that has none. The pipeline reads Doxygen's `<reimplements>` references and finds the member that wrote the text. It labels the record with `documentation.inheritedFrom` only when the override has no documentation comment of its own next to its declaration or definition. 470 overrides are labelled. 37 overrides repeat the base text in their own comment and are not labelled.

## Excluded records

| Reason                      | Count | Notes                                                                                         |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `preprocessor-macro`        | 104   | `#define` macros are not part of the C++ symbol model.                                        |
| `friend-class-relationship` | 65    | `friend class` declarations become relationships on the declaring class.                      |
| `anonymous-namespace`       | 50    | Internal-linkage code that is not part of any interface.                                      |
| `phantom-namespace`         | 14    | Namespaces Doxygen invents for out-of-line definitions such as `ReadView::SlesType::begin()`. |

## Remaining limitations

- **References that cannot be resolved (74).** 73 are uses of names Doxygen links to a `friend class` declaration that does not name an enclosing class. Friend declarations carry no structured reference to the befriended class, so these stay plain text. The 74th is a documentation link to a Doxygen `@defgroup` member that has no symbol record.
- **Base classes that cannot be linked (167 of 740).** Most are genuinely external (`std::exception`, `boost::...`). The rest are reached through alias templates (`HandlerFor<Input>`), which Doxygen does not link. They are shown as plain text.
- **Names Doxygen does not link.** Doxygen leaves some project type names in signatures unlinked, most commonly a class's own name inside its members. The pipeline links a name only when C++ scope rules prove what it refers to: an enclosing class's injected class name, not hidden by a nearer declaration, template parameter, or base class it cannot see (580 links). Everything else remains plain text.
- **Lines near, but not on, the declaration (165).** These are mostly multi-line declarations where Doxygen reports the line next to the name. They are reported as `nearby` and kept.
- **Documentation coverage.** 32.5% of symbols have documentation comments upstream. Undocumented symbols are presented as such.
- **No semantic analysis.** Overload resolution, template instantiation, `auto` deduction, and code inside function bodies are outside Doxygen's model. Call graphs are deferred.
- **`xrpl::nft::kPageMask` appears as a function.** It is a `constexpr UInt256` direct-initialised with a non-literal argument (`std::string_view("…")`), which Doxygen parses as a function declaration. `reclassify-literal-initialized-constants` accepts only literal arguments, because a non-literal argument does not prove the record is a variable. The declaration text and source link are correct.
- **Test code.** `src/test`, `src/tests` and `src/benchmarks` are excluded. Including them is a configuration change (`--categories production,test`); every record already carries a `category` field so that the website can filter them.

## Accommodating another extraction source

Clang-assisted parsing is deferred. The pipeline is split so that it can be added without touching the stages after normalisation:

- `extraction/` and `parsing/` are Doxygen-specific.
- `normalization/doxygen-symbols.js` converts Doxygen XML into the internal symbol model. A Clang source would provide its own converter to the same model.
- `normalization/corrections/` holds Doxygen-specific rules and would not apply to a Clang source.
- `resolution/`, `generation/` and `validation/` operate only on the internal model and the published contract in `contract/`.
- Every dataset records its extractor name, version and configuration hash in `manifest.json`.
