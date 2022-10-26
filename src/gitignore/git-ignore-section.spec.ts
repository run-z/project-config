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

      section.replace(section => {
        section.entry('a').ignore();
      });

      expect([...section.patterns()]).toEqual(['a']);
      expect(section.entry('a').effect).toBe('ignore');
    });
    it('removes unmodified entry', () => {
      const section = file.section('test');

      section.entry('a').ignore();
      section.entry('b').ignore();

      section.replace(section => {
        section.entry('a').ignore();
        section.entry('b');
      });

      expect([...section.patterns()]).toEqual(['a']);
      expect(section.entry('a').effect).toBe('ignore');
    });
  });
});
