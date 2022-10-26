import { beforeEach, describe, expect, it } from '@jest/globals';
import { GitIgnoreFile } from './git-ignore-file.js';

describe('GitIgnoreSection', () => {
  let file: GitIgnoreFile;

  beforeEach(() => {
    file = new GitIgnoreFile();
  });

  describe('replace', () => {
    it('retains modified entry', () => {
      const section = file.section('test');

      section.entry('a').ignore();
      section.entry('b').ignore();
      file.modify(false);

      section.replace(section => {
        section.entry('a').ignore();
      });

      expect([...section.patterns()]).toEqual(['a']);
      expect(section.entry('a').effect).toBe('ignore');
      expect(file.isModified).toBe(true);
    });
    it('removes unmodified entry', () => {
      const section = file.section('test');

      section.entry('a').ignore();
      section.entry('b').ignore();
      file.modify(false);

      section.replace(section => {
        section.entry('a').ignore();
        section.entry('b');
      });

      expect([...section.patterns()]).toEqual(['a']);
      expect(section.entry('a').effect).toBe('ignore');
      expect(file.isModified).toBe(true);
    });
    it('does not modify file if nothing replaced', () => {
      const section = file.section('test');

      section.entry('a').ignore();
      section.entry('b').ignore();
      file.modify(false);

      section.replace(section => {
        section.entry('b').ignore();
        section.entry('a').ignore();
      });

      expect([...section.patterns()]).toEqual(['a', 'b']);
      expect(file.isModified).toBe(false);
    });
  });
});
