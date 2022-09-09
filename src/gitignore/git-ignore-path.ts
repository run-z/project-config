import path from 'node:path';

/**
 * Creates pattern containing a file or directory path relative to root directory.
 *
 * @param rootDir - Root directory.
 * @param filePath - Path to target file or directory.
 *
 * @returns Path pattern starting with `/`.
 */
export function gitIgnorePath(rootDir: string, filePath: string): string {
  const relative = path.relative(rootDir, filePath);
  const result = path.sep === '/' ? relative : relative.replaceAll(path.sep, '/');

  if (result.startsWith('./') || result.startsWith('../')) {
    throw new TypeError(`Path outside the root dir: ${result}`);
  }

  return `/${result}`;
}
