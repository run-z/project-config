# build-z

`build-z` script transpiles and bundles TypeScript source files to `dist/` directory.

1. Add `rollup` to dev dependencies of the project:
   ```shell
   npm add -D rollup
   ```
2. Adjust `package.json` scripts:
   ```json
   {
     "exports": "./dist/main.js",
     "scripts": {
       "build": "build-z"
     }
   }
   ```
3. Invoke the build:
   ```shell
   npm run build
   ```

## Source Files and Package Exports

`build-z` expects all bundled files to be placed to `dist/` directory and listed as [entry points] in `package.json`.
Each entry point expected to have corresponding directory within `src/` containing entry source file called `main.ts`,
`mod.ts`, or `index.ts`.

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

Entry point names may have a `.js` extension. The corresponding source directory name may omit `.js` extension in this
case. So, the above file structure suits the following `package.json` contents too:

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/project-config.d.ts",
      "import": "./dist/project-config.js"
    },
    "./jest.js": {
      "types": "./dist/project-config.jest.d.ts",
      "import": "./dist/project-config.jest.js"
    },
    "./rollup.js": {
      "types": "./dist/project-config.rollup.d.ts",
      "import": "./dist/project-config.rollup.js"
    }
  }
}
```

[entry points]: https://nodejs.org/dist/latest/docs/api/packages.html#package-entry-points

## Customizing Rollup

`build-z` script utilizes [Rollup]. Rollup configuration is generated automatically.

To customize, add Rollup options to `project.config.js` file:

```javascript
export default {
  tools: {
    rollup: {
      // ...Options to apply on top of automatically generated ones.
    },
  },
};
```

[rollup]: https://rollupjs.org/

## Invoking Rollup Directly

Invoking `build-z` is the same as invoking `rollup -c node:@run-z/project-config/rollup.config.js`.

[Rollup configuration file][] (`rollup.config.js`) can also be used. It is used by Rollup when invoking `rollup -c`.

Options added to configuration file passed to Rollup instead of automatically generated ones. To use automatically
generated options and extend them, the `rollup.config.js` may look like this:

```javascript
import { configureRollup } from '@run-z/project-config`;

export default await configureRollup({
  // ...Options to apply on top of automatically generated ones.
});
```

Invoking `rollup -c` in this case has the same effect as invoking `build-z`.

[rollup configuration file]: https://rollupjs.org/guide/en/#configuration-files
