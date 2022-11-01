# build-z

`build-z` script transpiles and bundles TypeScript source files to `dist/` directory.

1. Add `rollup` to dev dependencies of the project:
   ```shell
   npm add rollup
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

[entry points]: https://nodejs.org/dist/latest/docs/api/packages.html#package-entry-points

## Customizing Rollup

`build-z` script utilizes [Rollup]. Rollup configuration is generated automatically.

To customize, add `rollup.config.js` [Rollup configuration] file at project root. This configuration can be passed
directly to Rollup by invoking `rollup -c`.

Options added to configuration file passed to Rollup instead of automatically generated ones. To use automatically
generated options and extend them, the `rollup.config.js` may like this:

```javascript
import { configureRollup } from '@run-z/project-config/rollup`;

export default await configureRollup({
  // ...Options to apply on top of automatically generated ones.
});
```

Invoking `rollup -c` in this case has the same effect as invoking `build-z`.

_Without configuration file_ it is also possible to achieve the same functionality as `build-z`. For that, invoke
Rollup like this:

```shell
rollup -c node:@run-z/project-config/rollup.config.js
```

[rollup]: https://rollupjs.org/
[rollup configuration]: https://rollupjs.org/guide/en/#configuration-files
