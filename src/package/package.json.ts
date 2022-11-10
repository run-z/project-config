/**
 * Subset of [package.json](https://docs.npmjs.com/cli/v6/configuring-npm/package-json) properties.
 */
export interface PackageJson {
  readonly name?: string | undefined;
  readonly version?: string | undefined;
  readonly exports?: PackageJson.Exports | undefined;
  readonly dependencies?: PackageJson.Dependencies;
  readonly devDependencies?: PackageJson.Dependencies;
  readonly peerDependencies?: PackageJson.Dependencies;
  readonly optionalDependencies?: PackageJson.Dependencies;
  readonly [key: string]: unknown;
}

export namespace PackageJson {
  /**
   * Entry corresponding to package
   * [entry point](https://nodejs.org/dist/latest/docs/api/packages.html#package-entry-points) within `package.json`.
   */
  export interface EntryPoint {
    /**
     * Exported path or pattern.
     */
    readonly path: '.' | `./${string}`;

    /**
     * Searches for path or pattern matching all provided conditions.
     *
     * @param conditions - Required export conditions. When missing, searches for `default` one.
     *
     * @returns Matching path or pattern, or `undefined` when not found.
     */
    findConditional(...conditions: string[]): `./${string}` | undefined;
  }

  export type Dependencies = {
    readonly [name in string]: string;
  };

  export type Exports = PathExports | TopConditionalExports | `./${string}`;

  export type PathExports = {
    readonly [key in '.' | `./${string}`]: ConditionalExports | `./${string}`;
  };

  export type ConditionalExports = {
    readonly [key in string]: ConditionalExports | `./${string}`;
  };

  export type TopConditionalExports = {
    readonly [key in string]: TopConditionalExports | PathExports | `./${string}`;
  };
}
