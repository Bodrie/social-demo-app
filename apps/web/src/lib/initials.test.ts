import { initials } from './initials';

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Alice Anderson')).toBe('AA');
    expect(initials('  bob  ')).toBe('B');
    expect(initials('Mary Jane Watson')).toBe('MJ');
  });
});
