# Development Tools for TypeScript Projects

[![NPM][npm-image]][npm-url]
[![Build Status][build-status-img]][build-status-link]
[![GitHub Project][github-image]][github-url]
[![API Documentation][api-docs-image]][api documentation]

- Provides a set of [build tools][].

  Such as `build-z` to bundle project files, or `clean-z` to clean the output.

- Provides configuration support for various development tools.

  Such as [Rollup] and [Jest].

- Implies [project layout][].

  All development and build tools respect this layout.

- Maintains some project configuration files.

  Such as `.gitignore` and `.npmignore`.

## Installation

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

## Project Layout

[project layout]: #project-layout

Project configuration implied to have the following directories:

- `src/` directory for TypeScript sources.
- `dist/` directory for distribution files.
- `target/` directory for build targets not supposed to be published by NPM.

There is also a cache directory created automatically in temporary system directory.

This can me customized.

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

The following tools supported:

- [build-z] - transpiles and bundles TypeScript source files with [Rollup].
- [clean-z] - cleans the output by deleting output directories (`dist/`, `target/`, and cache one, according to
  [project layout]).
- [test-z] - runs project tests with [Jest].

[build-z]: https://github.com/run-z/project-config/tree/master/doc/build-z.md
[clean-z]: https://github.com/run-z/project-config/tree/master/doc/clean-z.md
[test-z]: https://github.com/run-z/project-config/tree/master/doc/test-z.md
