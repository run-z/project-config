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

  describe('section', () => {
    it('caches section', () => {
      const file = new GitIgnoreFile();
      const section = file.section('test');

      expect(section.title).toBe('test');
      expect(section.file).toBe(file);
      expect(file.section('test')).toBe(section);
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

  describe('entry', () => {
    it('creates detached entry in default section', () => {
      const file = new GitIgnoreFile();
      const entry = file.entry('pattern');

      expect(entry.isDetached).toBe(true);
      expect(entry.pattern).toBe('pattern');
      expect(entry.effect).toBe('ignore');
      expect(entry.match).toBe('all');
      expect(entry.section.title).toBe('');
      expect(file.isModified).toBe(false);
    });
    it('create detached entry matching only directories', () => {
      const file = new GitIgnoreFile();
      const entry = file.entry('pattern/');

      expect(entry.isDetached).toBe(true);
      expect(entry.pattern).toBe('pattern');
      expect(entry.effect).toBe('ignore');
      expect(entry.match).toBe('dirs');
      expect(entry.section.title).toBe('');
      expect(file.isModified).toBe(false);
    });
    it('create detached re-including entry', () => {
      const file = new GitIgnoreFile();
      const entry = file.entry('!pattern');

      expect(entry.isDetached).toBe(true);
      expect(entry.pattern).toBe('pattern');
      expect(entry.effect).toBe('include');
      expect(entry.match).toBe('all');
      expect(entry.section.title).toBe('');
      expect(file.isModified).toBe(false);
    });
    it('obtains attached entry', () => {
      const file = new GitIgnoreFile().parse(`
# test
pattern/
`);
      const entry = file.entry('pattern');

      expect(entry.isDetached).toBe(false);
      expect(entry.pattern).toBe('pattern');
      expect(entry.effect).toBe('ignore');
      expect(entry.match).toBe('dirs');
      expect(entry.section.title).toBe('test');
      expect(file.isModified).toBe(false);
    });
    it('updates match of attached entry', () => {
      const file = new GitIgnoreFile().parse(`
# test
pattern
`);
      const entry = file.entry('pattern/');

      expect(entry.isDetached).toBe(false);
      expect(entry.pattern).toBe('pattern');
      expect(entry.effect).toBe('ignore');
      expect(entry.match).toBe('dirs');
      expect(entry.section.title).toBe('test');
      expect(file.isModified).toBe(true);
    });
    it('updates effect of attached entry', () => {
      const file = new GitIgnoreFile().parse(`
# test
pattern/
`);
      const entry = file.entry('!pattern');

      expect(entry.isDetached).toBe(false);
      expect(entry.pattern).toBe('pattern');
      expect(entry.effect).toBe('include');
      expect(entry.match).toBe('dirs');
      expect(entry.section.title).toBe('test');
      expect(file.isModified).toBe(true);
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
