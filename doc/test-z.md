# test-z

`test-z` script runs project tests located in `src/` directory.

1. Add `jest` and other test dependencies to dev dependencies of the project:
   ```shell
   npm add -D jest jest-junit ts-jest @swc/core @swc/jest
   ```
2. Adjust `package.json` scripts:
   ```json
   {
     "scripts": {
       "test": "test-z"
     }
   }
   ```
3. Invoke the build:
   ```shell
   npm run test
   ```

The script passes [Command line options][] directly to Jest.

[command line options]: https://jestjs.io/docs/cli

## Selecting Test Runner

`test-z` uses either [@swc/jest] or [ts-jest] as test runner.

By default, SWC is used. This makes tests run faster, but compile errors in tests not always lead to failed tests.

To switch to `ts-jest`, set `RUNZ_TEST_RUNNER` environment variable to `ts-jest` like this:

```shell
RUNZ_TEST_RUNNER=ts-jest npm run test
```

[@swc/jest]: https://swc.rs/docs/usage/jest
[ts-jest]: https://kulshekhar.github.io/ts-jest/

## Customizing Jest

`test-z` script utilizes [Jest]. Jest configuration is generated automatically.

To customize, add Jest options to `project.config.js` file:

```javascript
export default {
  jest: {
    // ...Options to apply on top of automatically generated ones.
  },
};
```

[jest]: https://jestjs.io/

## Invoking Jest Directly

Invoking `test-z` generates Jest configuration automatically, unless [Jest configuration file][] (`jest.config.js`)
present. In the latter case the custom configuration will be used. It also can be used by Jest when invoking `jest`.

Options added to configuration file passed to Jest instead of automatically generated ones. To use automatically
generated options and extend them, the `jest.config.js` may look like this:

```javascript
import { configureJest } from '@run-z/project-config`;

export default await configureJest({
  // ...Options to apply on top of automatically generated ones.
});
```

Invoking `jest` in this case has the same effect as invoking `test-z`.

[jest configuration file]: https://jestjs.io/docs/configuration
