import { beforeEach, describe, expect, it } from '@jest/globals';
import { GitIgnoreFile } from '../mod.js';

describe('GitIgnoreEntry', () => {
  let file: GitIgnoreFile;

  beforeEach(() => {
    file = new GitIgnoreFile();
  });

  describe('effect', () => {
    it('is `ignore` by default', () => {
      const entry = file.entry('pattern');

      expect(entry.isDetached).toBe(true);
      expect(entry.effect).toBe('ignore');
    });
  });

  describe('match', () => {
    it('is `all` by default', () => {
      const entry = file.entry('pattern');

      expect(entry.isDetached).toBe(true);
      expect(entry.match).toBe('all');
    });
  });

  describe('ignore', () => {
    it('ignores files matching pattern', () => {
      const entry = file.section('test').entry('pattern');

      entry.ignore();
      entry.ignore();

      expect(file.section('test').entry('pattern')).toBe(entry);
      expect(entry.effect).toBe('ignore');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
pattern
`);
    });
    it('moves pattern to another section', () => {
      const entry = file.parse('!pattern').section('test').entry('pattern');

      entry.ignore();

      expect(file.section('test').entry('pattern')).toBe(entry);
      expect(entry.effect).toBe('ignore');
      expect(entry.section.title).toBe('test');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
pattern
`);
    });
  });

  describe('ignore(false)', () => {
    it('re-includes files matching pattern', () => {
      const entry = file.section('test').entry('pattern');

      entry.ignore(false);

      expect(file.section('test').entry('pattern')).toBe(entry);
      expect(entry.effect).toBe('include');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
!pattern
`);
    });
    it('moves pattern to another section', () => {
      const entry = file.parse('pattern').section('test').entry('pattern');

      entry.ignore(false);

      expect(file.section('test').entry('pattern')).toBe(entry);
      expect(entry.effect).toBe('include');
      expect(entry.section.title).toBe('test');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
!pattern
`);
    });
  });

  describe('setMatch', () => {
    it('makes pattern match only directories', () => {
      const entry = file.parse('pattern').entry('pattern');

      expect(entry.isDetached).toBe(false);

      entry.setMatch('dirs');

      expect(entry.match).toBe('dirs');
      expect(file.toString('\n')).toBe(`pattern/
`);
    });
    it('makes pattern match both files and directories', () => {
      const entry = file.parse('pattern/').entry('pattern');

      expect(entry.isDetached).toBe(false);

      entry.setMatch('all');

      expect(entry.match).toBe('all');
      expect(file.toString('\n')).toBe(`pattern
`);
    });
    it('does not attach detached entry', () => {
      const entry = file.section('test').entry('pattern').setMatch('dirs');

      expect(entry.isDetached).toBe(true);
      expect(entry.match).toBe('dirs');

      entry.ignore();

      expect(entry.isDetached).toBe(false);
      expect(file.toString()).toBe(`# test
pattern/
`);
    });
    it('updates previously attached entry', () => {
      const entry = file.parse('pattern').entry('pattern');
      const entry2 = file.section('test').entry('pattern');

      expect(entry.isDetached).toBe(false);
      expect(entry2.isDetached).toBe(true);

      entry2.setMatch('dirs').ignore();

      expect(entry.isDetached).toBe(true);
      expect(entry2.isDetached).toBe(false);

      expect(entry.section.title).toBe('');
      expect(entry.currentSection?.title).toBe('test');
      expect(entry2.section.title).toBe('test');
      expect(entry2.currentSection?.title).toBe('test');
    });
  });

  describe('remove', () => {
    it('removes entry from section', () => {
      const section = file.parse('pattern').section('');
      const entry = section.entry('pattern');

      expect(entry.isDetached).toBe(false);

      entry.remove();

      expect(entry.isDetached).toBe(true);
      expect(entry.file).toBe(file);
      expect(entry.section).toBe(section);
      expect(entry.currentSection).toBeUndefined();
      expect(file.section('').entry('pattern').isDetached).toBe(true);
      expect([...file.section('').entries()]).toHaveLength(0);
      expect(file.section('test').entry('pattern').isDetached).toBe(true);
      expect([...file.section('test').entries()]).toHaveLength(0);
      expect(file.isModified).toBe(true);
      expect(file.section('').entry('pattern').section.title).toBe('');
      expect(file.section('test').entry('pattern').section.title).toBe('test');
      expect(file.toString()).toEqual(`# test
`);
    });
  });
});
