# Source Code Optimizer

A local-first minifier for JavaScript, HTML, and CSS. Import a file or paste code, compare the original with a smaller copy, and download the result. Your source stays on your computer.

<img width="1393" height="955" alt="image" src="https://github.com/user-attachments/assets/52b13139-da74-4b2b-8db4-33fbc7f642b1" />

## Open the app

After setup, Windows users can double-click **Start Source Code Optimizer.cmd**. Keep its terminal window open while using the app. Close that window to stop the local server.

Install Node.js 22.12 or newer, clone this repository, and run these commands from the project folder:

```sh
npm install
npm run build
npm start
```

Open http://127.0.0.1:4173 in your browser. Build once after setup, then use npm start for subsequent runs. Rebuild after changing the interface. Development: `npm run dev`. Tests: `npm test`.

## Optimization levels

Choose a level in the browser, or use `--level` in the command line. Balanced is the default.

| Level | JavaScript | CSS | HTML |
| --- | --- | --- | --- |
| Conservative | Remove formatting/comments; retain variable names and expressions | Remove formatting/comments; skip value/rule optimizations | Remove comments; preserve text whitespace and quoted attributes |
| Balanced | Compress expressions, shorten local names; retain function/class names | Level-one value optimizations | Same conservative HTML handling |
| Aggressive | Five compression passes; allow internal function/class name changes | Level-two rule merging/restructuring | Also remove attribute quotes where valid |

All levels preserve top-level JavaScript bindings and property names, avoid unsafe Terser options, and preserve license comments by default. Aggressive can affect code that inspects names or source text and requires project-level testing. Higher levels do not guarantee a smaller result on every file. HTML text whitespace collapse is always a separate opt-in option.

## Command line

Run these commands from this project folder:

```sh
node cli.mjs path/to/app.js
node cli.mjs path/to/app.js --level aggressive
node cli.mjs path/to/styles.css --level conservative --output path/to/styles.small.css
node cli.mjs path/to/page.html --collapse-whitespace
node cli.mjs --help
```

By default, `app.js` produces `app.min.js`. Existing output files are refused unless you pass `--force`; input files are never intentionally overwritten. `--remove-license-comments` disables license preservation. Files must be valid UTF-8, up to 1 MiB; each run has a 15-second processing limit. Errors return a nonzero exit code.

For the short `source-code-optimizer` command, optionally run `npm link` in this folder. You can also use `npm run minify -- path/to/app.js --level aggressive` without installing a command globally.

## Engine behavior (Balanced)

- JavaScript: Terser compression and local-variable renaming, preserving public bindings, property names, function/class names and argument counts.
- CSS: clean-css level-one optimizations, with parsing before and after. External imports and asset paths are left untouched.
- HTML: comment removal and conservative processing. Text whitespace is preserved by default. Optional collapse keeps inline word separation but may change whitespace-sensitive rendering. Embedded scripts and styles are preserved; optimize those separately.
- UTF-8 byte counts, percentage savings, read-only preview, copy and `.min` file downloads.
- License-comment preservation enabled by default. Recognizes `!`, `@license`, `@preserve`, and copyright notices; unusual license markers should be checked manually.
- Separate drafts for each language. Editing source or options invalidates old output. Source is held in memory only; refresh clears edits.

## Boundaries

Version 0.1 handles one UTF-8 file at a time, up to 1 MiB. It does not bundle projects, resolve dependencies, transpile TypeScript/JSX, obfuscate, optimize executable binaries, or promise faster runtime. JavaScript/CSS parse checks are not proof of identical behavior. HTML processing is not full HTML validation. Test exported files in your own project, especially code relying on function source text or exact HTML comments/whitespace.

Minifiers run in a local worker with a 15-second limit. Imported code is never executed. A candidate that is larger than the input is discarded in favor of the original. Some required line breaks and important comments may remain. The app makes no claim to find the mathematically smallest program.

The server binds to 127.0.0.1, rejects foreign origins, and serves only the built UI. There are no analytics, remote fonts, or cloud processing. Dependencies require internet access for initial installation; normal use does not.

## Project layout

- `src/optimizer.mjs`: language engines and validation.
- `src/optimizer-worker.mjs`: isolated processing entry point.
- `server.mjs`: local API and production file serving.
- `src/main.jsx`, `src/styles.css`: interface.
- `tests/`: optimizer regression and local API tests.

Engine documentation: [Terser](https://terser.org/docs/api-reference/), [clean-css](https://github.com/clean-css/clean-css), [html-minifier-terser](https://github.com/terser/html-minifier-terser).
