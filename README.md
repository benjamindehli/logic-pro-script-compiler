# @benjamindehli/logic-pro-script-compiler

Compiles JavaScript files to `.pst` files for the [Logic Pro Scripter](https://support.apple.com/en-gb/guide/logicpro/lgce728c68f6/mac) MIDI plugin.

Logic Pro's Scripter plugin uses a binary `.pst` format to store scripts. This tool takes standard `.js` source files, transpiles them for compatibility with Logic Pro's JavaScript engine, and packages them into the correct binary format, letting you write and maintain scripts in a modern editor with your usual tooling.

## Requirements

- Node.js >= 16

## Usage

### One-off with npx

Run without installing, passing your own input and output directories:

```sh
npx @benjamindehli/logic-pro-script-compiler -i ./src -o ./build
```

> **Note:** Do not run this from inside the `logic-pro-script-compiler` package directory itself. Run it from your own project.

### Global install

```sh
npm install -g @benjamindehli/logic-pro-script-compiler
logic-pro-script-compiler -i ./src -o ./build
```

## Options

| Flag | Alias | Description | Default |
| ---- | ----- | ----------- | ------- |
| `--input` | `-i` | Directory containing `.js` source files | `./src` |
| `--output` | `-o` | Directory to write `.pst` files to | `./build` |
| `--help` | `-h` | Show help | |

## How it works

1. **Transpile** — Each `.js` file is passed through Babel with the following transforms:
   - `const`/`let` → `var` (block scoping)
   - Optional chaining (`?.`) → equivalent conditional expressions
   - Spread syntax (`...`) → explicit concatenation
2. **Package** — The transpiled source is wrapped in a binary `bplist` structure and written into the `.pst` chunk format that Logic Pro expects.

The output directory mirrors the structure of the input directory, so nested folders are preserved.

## Example

Given this source tree:

```text
src/
  DigiTech Whammy/
    MIDI Note to Whammy Pitch.js
  Elektron SidStation/
    Editor.js
```

Running:

```sh
npx @benjamindehli/logic-pro-script-compiler -i ./src -o ./build
```

Produces:

```text
build/
  DigiTech Whammy/
    MIDI Note to Whammy Pitch.pst
  Elektron SidStation/
    Editor.pst
```

Each `.pst` file can be opened directly in the Logic Pro Scripter plugin.

## Programmatic API

The package also exposes its internals for use in Node.js scripts:

```js
const { buildBplist, transpile, compileToPst, processDirectory } = require("@benjamindehli/logic-pro-script-compiler");
```

### `transpile(jsSource) → string`

Transpiles a JavaScript string using Babel. Returns the transpiled source code.

### `buildBplist(jsBytes) → Buffer`

Wraps a UTF-8 `Buffer` of transpiled JavaScript in the bplist binary format. Throws if the script exceeds 65535 bytes.

### `compileToPst(jsSource) → Buffer`

Transpiles and packages a JavaScript string into a complete `.pst` `Buffer` ready to be written to disk.

### `processDirectory(srcDir, buildDir)`

Recursively walks `srcDir`, compiles every `.js` file found, and writes the resulting `.pst` files to the mirrored path under `buildDir`. Dotfiles and non-`.js` files are skipped.

## License

GPL-3.0 © [Benjamin Dehli](https://github.com/benjamindehli)
