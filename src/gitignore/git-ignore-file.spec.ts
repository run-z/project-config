import { describe, expect, it } from '@jest/globals';
import os from 'node:os';
import { GitIgnoreFile } from './git-ignore-file.js';

describe('GitIgnoreFile', () => {
  describe('isModified', () => {
    it('is `false` for empty file', () => {
      expect(new GitIgnoreFile().isModified).toBe(false);
    });
    it('is `false` when file parsed', () => {
      expect(new GitIgnoreFile().parse('pattern').isModified).toBe(false);
    });
  });

  describe('sections', () => {
    it('recognizes initial section', () => {
      const file = new GitIgnoreFile().parse('/some/path');

      expect([...file.sections()]).toEqual([
        expect.objectContaining({
          title: '',
        }),
      ]);
      expect(file.toString('\n')).toBe(`/some/path
`);
    });
    it('recognizes named section', () => {
      const file = new GitIgnoreFile().parse(`
# Section 1
/some/path
`);

      expect([...file.sections()]).toEqual([
        expect.objectContaining({
          title: 'Section 1',
        }),
      ]);
      expect(file.toString('\n')).toBe(`# Section 1
/some/path
`);
    });
    it('recognizes empty named section', () => {
      const file = new GitIgnoreFile().parse(`
# Section 1



# Section 2`);

      expect([...file.sections()].map(({ title }) => title)).toEqual(['Section 1', 'Section 2']);
      expect(file.toString('\n')).toBe(`# Section 1

# Section 2
`);
    });
    it('recognizes multi-line section title', () => {
      const file = new GitIgnoreFile().parse(`# Section
#
#   1
/some/path
`);

      expect([...file.sections()].map(({ title }) => title)).toEqual(['Section\n1']);
      expect(file.toString('\n')).toBe(`# Section
# 1
/some/path
`);
    });
    it('recognizes multiple sections', () => {
      const file = new GitIgnoreFile().parse(`
/some/path

# Section 1
#
#
/some/path1

# Section 2
/some/path2

#Section 3
`);

      expect([...file.sections()]).toEqual([
        expect.objectContaining({
          title: '',
        }),
        expect.objectContaining({
          title: 'Section 1',
        }),
        expect.objectContaining({
          title: 'Section 2',
        }),
        expect.objectContaining({
          title: 'Section 3',
        }),
      ]);
      expect(file.toString('\n')).toBe(`/some/path

# Section 1
/some/path1

# Section 2
/some/path2

# Section 3
`);
    });
  });

  describe('entries', () => {
    it('recognizes escaped `#`', () => {
      const file = new GitIgnoreFile().parse('\\#pattern');

      expect([...file.entries()]).toEqual([
        expect.objectContaining({ pattern: '#pattern', effect: 'ignore' }),
      ]);
      expect(file.toString('\n')).toBe(`\\#pattern
`);
    });
    it('recognizes trailing spaces ending with `\\`', () => {
      const file = new GitIgnoreFile().parse('/pattern    \\  ');

      expect([...file.entries()].map(({ pattern }) => pattern)).toEqual(['/pattern    ']);
      expect(file.toString('\n')).toBe(`/pattern    \\
`);
    });
    it('removes trailing whitespace', () => {
      const file = new GitIgnoreFile().parse('/pattern     ');

      expect([...file.entries()].map(({ pattern }) => pattern)).toEqual(['/pattern']);
      expect(file.toString('\n')).toBe(`/pattern
`);
    });
    it('recognizes re-including pattern', () => {
      const file = new GitIgnoreFile().parse('!pattern');

      expect([...file.entries()]).toEqual([
        expect.objectContaining({ pattern: 'pattern', effect: 'include' }),
      ]);
      expect(file.toString('\n')).toBe(`!pattern
`);
    });
  });

  describe('toString', () => {
    it('appends default section added after named one', () => {
      const file = new GitIgnoreFile();

      file.section('test');
      file.section('');

      expect(file.toString()).toBe(`# test${os.EOL}${os.EOL}#${os.EOL}`);
    });
  });
});
