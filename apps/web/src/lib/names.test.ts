import { firstName, initials } from './names';

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Alice Anderson')).toBe('AA');
    expect(initials('  bob  ')).toBe('B');
    expect(initials('Mary Jane Watson')).toBe('MJ');
  });
});

describe('firstName', () => {
  it('returns the first word', () => {
    expect(firstName('Alice Anderson')).toBe('Alice');
    expect(firstName('  bob ')).toBe('bob');
  });
});
