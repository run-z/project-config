import { beforeEach, describe, expect, it } from '@jest/globals';
import { GitIgnoreFile } from '../mod.js';

describe('GitIgnoreEntry', () => {
  let file: GitIgnoreFile;

  beforeEach(() => {
    file = new GitIgnoreFile();
  });

  describe('ignore', () => {
    it('ignores files matching pattern', () => {
      const entry = file.section('test').entry('pattern');

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

  describe('remove', () => {
    it('removes entry from section', () => {
      const entry = file.parse('pattern').section('').entry('pattern');

      expect(entry.isDetached).toBe(false);

      entry.remove();

      expect(entry.isDetached).toBe(true);
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
