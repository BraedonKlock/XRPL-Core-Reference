# Developer notes

Hand-written guidance shown on symbol pages, alongside the generated Doxygen documentation. Each file adds up to two collapsed sections to a symbol's page: **Developer notes** (Purpose and Important notes) and **Code examples**.

- There is one JSON file per function family or class. Edit them by hand.
- Files live anywhere under `developer-notes/` and are committed to git. Doxygen generation never touches this directory.
- A symbol without a file renders exactly as before.

## Example

`developer-notes/xrpl/isXRP.json`:

```json
{
  "schemaVersion": 2,
  "symbol": "xrpl::isXRP",
  "verifiedAt": "c2534ff9c84422e00711da31629a76f3f59feb98",
  "purpose": "`isXRP` answers one question: does this value represent XRP?",
  "importantNotes": "How the answer is determined depends on the argument's type.\n\n- See [`Asset::native`](symbol:xrpl::Asset::native()const).",
  "examples": [
    {
      "signature": "xrpl::isXRP(Asset const&)",
      "title": "Checking an Asset",
      "explanation": "Optional Markdown.",
      "code": "bool const native = isXRP(asset);"
    }
  ]
}
```

## Fields

| Field            | Required | Meaning                                                                                                    |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `schemaVersion`  | yes      | Always `2`.                                                                                                |
| `symbol`         | yes      | The qualified name of the function family or class, e.g. `xrpl::isXRP` or `xrpl::STTx`.                    |
| `purpose`        | no       | Markdown. What the symbol is for.                                                                          |
| `importantNotes` | no       | Markdown. Anything a developer should know before using it.                                                |
| `examples`       | no       | A list of code examples (see below).                                                                       |
| `verifiedAt`     | no       | The full rippled commit you checked the content against. A different commit shows an "out of date" notice. |
| `draft`          | no       | `true` keeps the whole file out of production builds.                                                      |

Each example has:

| Field         | Required                               | Meaning                                                  |
| ------------- | -------------------------------------- | -------------------------------------------------------- |
| `signature`   | for functions; not allowed for classes | The exact overload the example belongs to.               |
| `title`       | yes                                    | Plain text.                                              |
| `code`        | yes                                    | C++ source. It is shown highlighted, with a Copy button. |
| `explanation` | no                                     | Markdown.                                                |
| `draft`       | no                                     | `true` keeps this example out of production builds.      |

A file needs at least one of `purpose`, `importantNotes` or `examples`. Unknown fields are rejected, which catches typos. In JSON, write a line break as `\n` and a paragraph break as `\n\n`.

## Where content appears

- **Purpose and Important notes** appear on the class page, or, for a function, on the overload list and on every overload's page.
- **Code examples** for a function appear only on the page of the overload named by `signature`. For a class, all examples appear on the class page.

## Signatures

A signature is the key the site uses for each overload: the qualified name, then the parameter types, then any qualifiers, with spaces compacted. Examples: `xrpl::isXRP(Asset const&)`, `xrpl::ApplyContext::view()const`.

To find the exact signatures, run the validator with an example whose `signature` is missing or wrong. The error lists every valid signature for that function.

## Markdown

`purpose`, `importantNotes` and `explanation` support:

- paragraphs (blank lines);
- `- ` and `1. ` lists;
- `` `code` ``, `*emphasis*` and `**strong**`;
- fenced code blocks;
- links:
  - `[text](https://…)` for external pages;
  - `[text](symbol:xrpl::STTx)` for a class or a function's overload list;
  - `[text](symbol:xrpl::isXRP(Asset const&))` for one overload.

HTML is shown as text. Any other link scheme is a validation error.

## Drafts

Set `"draft": true` on a file, or on a single example, while it is unreviewed.

- `npm run dev` shows drafts, marked "Draft".
- `npm run build` and `npm run build:pages` leave them out entirely, neither their content nor their file names reach the bundle.

## Validation

```
npm run notes:validate
```

This checks every file against the published dataset. It reports:

- invalid JSON and unknown or missing fields;
- duplicate files for one symbol;
- symbols that don't exist;
- example signatures that aren't overloads of the file's function, and signatures on non-function symbols;
- broken `symbol:` links and unsafe links.

It warns about drafts and about `verifiedAt` commits that differ from the dataset. `npm test` runs the same checks.

## Future rippled versions

Files name symbols by qualified name and signature, not by generated IDs, so they carry over between rippled commits.

- When the dataset is regenerated, the validator reports any symbol or signature that no longer exists.
- Set `verifiedAt` again after re-checking the content.
