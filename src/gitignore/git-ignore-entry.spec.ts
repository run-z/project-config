import { beforeEach, describe, expect, it } from '@jest/globals';
import { GitIgnoreFile } from '../mod.js';

describe('GitIgnoreEntry', () => {
  let file: GitIgnoreFile;

  beforeEach(() => {
    file = new GitIgnoreFile();
  });

  describe('ignore', () => {
    it('ignores pattern', () => {
      file.section('test').entry('pattern').ignore();

      expect(file.section('test').entry('pattern').isIgnored).toBe(true);
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
pattern
`);
    });
    it('does not move pattern to another section', () => {
      file.parse('!pattern').section('test').entry('pattern').ignore();

      expect(file.section('').entry('pattern').section.title).toBe('');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`pattern

# test
`);
    });
    it('moves pattern to another section after removal', () => {
      file
        .parse('!pattern')
        .section('test')
        .entry('pattern')
        .remove()
        .file.section('test')
        .entry('pattern')
        .ignore();

      expect(file.section('').entry('pattern').section.title).toBe('test');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
pattern
`);
    });
  });

  describe('unIgnore', () => {
    it('un-ignores pattern', () => {
      file.section('test').entry('pattern').unIgnore();

      expect(file.section('test').entry('pattern').isIgnored).toBe(false);
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
!pattern
`);
    });
    it('does not move pattern to another section', () => {
      file.parse('pattern').section('test').entry('pattern').unIgnore();

      expect(file.section('').entry('pattern').section.title).toBe('');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`!pattern

# test
`);
    });
    it('moves pattern to another section after removal', () => {
      file
        .parse('pattern')
        .section('test')
        .entry('pattern')
        .remove()
        .file.section('test')
        .entry('pattern')
        .unIgnore();

      expect(file.section('').entry('pattern').section.title).toBe('test');
      expect(file.isModified).toBe(true);
      expect(file.toString()).toEqual(`# test
!pattern
`);
    });
  });

  describe('remove', () => {
    it('removes entry from section', () => {
      file.parse('pattern').section('test').entry('pattern').remove();

      expect(file.section('').entry('pattern').isRemoved).toBe(true);
      expect([...file.section('').entries()]).toHaveLength(0);
      expect(file.section('test').entry('pattern').isRemoved).toBe(true);
      expect([...file.section('test').entries()]).toHaveLength(0);
      expect(file.isModified).toBe(true);
      expect(file.section('').entry('pattern').section.title).toBe('');
      expect(file.section('test').entry('pattern').section.title).toBe('test');
      expect(file.toString()).toEqual(`# test
`);
    });
  });
});
