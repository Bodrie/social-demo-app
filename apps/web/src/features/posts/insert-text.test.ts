import { insertText } from './insert-text';

describe('insertText', () => {
  it('inserts at the caret and replaces a selection', () => {
    expect(insertText('hello world', 5, 5, ' 👋')).toEqual({ value: 'hello 👋 world', caret: 8 });
    expect(insertText('hello world', 0, 5, 'bye')).toEqual({ value: 'bye world', caret: 3 });
  });

  it('clamps out-of-range positions', () => {
    expect(insertText('abc', 10, 20, '!')).toEqual({ value: 'abc!', caret: 4 });
    expect(insertText('abc', -1, -1, '!')).toEqual({ value: '!abc', caret: 1 });
  });
});
