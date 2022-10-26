# Development Tools for TypeScript Projects

[![NPM][npm-image]][npm-url]
[![Build Status][build-status-img]][build-status-link]
[![GitHub Project][github-image]][github-url]
[![API Documentation][api-docs-image]][api documentation]

Provides:

- Set of [build tools][].

  Such as `build-z` to bundle project files, or `clean-z` to clean output.

- Configuration support for other development tools.

  Such as [Rollup] and [Jest].

- Default [project layout][].

  All development and build tools respect this layout.

Add `@run-z/project-config` to your project:

```shell
npm add --save-dev @run-z/project-config
```

and start using its tooling.

[npm-image]: https://img.shields.io/npm/v/@run-z/project-config.svg?logo=npm
[npm-url]: https://www.npmjs.com/package/@run-z/project-config
[build-status-img]: https://github.com/run-z/project-config/workflows/Build/badge.svg
[build-status-link]: https://github.com/run-z/project-config/actions?query=workflow:Build
[github-image]: https://img.shields.io/static/v1?logo=github&label=GitHub&message=project&color=informational
[github-url]: https://github.com/run-z/project-config
[api-docs-image]: https://img.shields.io/static/v1?logo=typescript&label=API&message=docs&color=informational
[api documentation]: https://run-z.github.io/project-config
[jest]: https://jestjs.io/
[rollup]: https://rollupjs.org/

## Build Tools

[build tools]: #build-tools

Build tools are scripts that can be added to project's `package.json`:

```json
{
  "scripts": {
    "build": "build-z",
    "clean": "clean-z",
    "lint": "lint-z",
    "test": "test-z"
  }
}
```

Then these tools cab be invoked to perform particular tasks:

```shell
npm run clean  # Clean output
npm run lint   # Perform linting
npm run test   # Run project tests
npm run build  # Bundle project files
```

## Project Layout

[project layout]: #project-layout

Directories:

- `src/` directory for TypeScript sources.
- `dist/` directory for distribution files.
- `target/` directory for build targets not supposed to be published at NPM.

There is also a cache directory created automatically in temporary system directory.

This can me customized.

### Source Files and Package Exports

Each [entry point] in `package.json` expected to have corresponding directory within `src/` containing entry source
file called `main.ts`, `mod.ts`, or `index.ts`.

E.g. with the following `package.json` contents:

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/project-config.d.ts",
      "import": "./dist/project-config.js"
    },
    "./jest": {
      "types": "./dist/project-config.jest.d.ts",
      "import": "./dist/project-config.jest.js"
    },
    "./rollup": {
      "types": "./dist/project-config.rollup.d.ts",
      "import": "./dist/project-config.rollup.js"
    }
  }
}
```

The file structure has to look like this:

```
src/
  mod.ts -- main entry source file.
  jest/
    mod.ts -- source file for `./jest` entry.
  rollup/
    mod.ts -- source file for `./rollup` entry.
```

[entry point]: https://nodejs.org/dist/latest/docs/api/packages.html#package-entry-points
