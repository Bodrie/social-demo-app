import { type BubblesState, EMPTY_BUBBLES, bubblesReducer } from './bubbles-state';

const arrive = (state: BubblesState, id: string) => bubblesReducer(state, { type: 'arrive', id });
const open = (state: BubblesState, id: string, maxWindows = 2) =>
  bubblesReducer(state, { type: 'open', id, maxWindows });

describe('bubblesReducer', () => {
  it('adds a bubble at the newest end and moves a known one there', () => {
    let state = arrive(arrive(EMPTY_BUBBLES, 'a'), 'b');
    expect(state.bubbles).toEqual(['a', 'b']);
    state = arrive(state, 'a');
    expect(state.bubbles).toEqual(['b', 'a']);
  });

  it('keeps four bubbles at most, evicting the oldest without a window', () => {
    let state = ['a', 'b', 'c', 'd'].reduce(arrive, EMPTY_BUBBLES);
    state = open(state, 'a');
    state = arrive(state, 'e');
    expect(state.bubbles).toEqual(['a', 'c', 'd', 'e']);
    expect(state.windows).toEqual(['a']);
  });

  it('opens at most the allowed windows, dropping the least recently opened', () => {
    let state = ['a', 'b', 'c'].reduce(arrive, EMPTY_BUBBLES);
    state = open(open(state, 'a'), 'b');
    expect(state.windows).toEqual(['a', 'b']);
    state = open(state, 'c');
    expect(state.windows).toEqual(['b', 'c']);
    expect(state.bubbles).toEqual(['a', 'b', 'c']);
    state = open(state, 'b');
    expect(state.windows).toEqual(['c', 'b']);
    expect(open(state, 'zzz')).toBe(state);
  });

  it('leaves the bubble when a window is minimised and drops both on dismiss', () => {
    let state = open(arrive(EMPTY_BUBBLES, 'a'), 'a');
    state = bubblesReducer(state, { type: 'minimise', id: 'a' });
    expect(state).toMatchObject({ bubbles: ['a'], windows: [] });
    state = open(state, 'a');
    state = bubblesReducer(state, { type: 'dismiss', id: 'a' });
    expect(state.bubbles).toEqual([]);
    expect(state.windows).toEqual([]);
    expect(state.hidden.has('a')).toBe(true);
  });

  it('brings a dismissed conversation back on its next message, and a message in an open window changes nothing', () => {
    let state = bubblesReducer(arrive(EMPTY_BUBBLES, 'a'), { type: 'dismiss', id: 'a' });
    state = arrive(state, 'a');
    expect(state.bubbles).toEqual(['a']);
    expect(state.hidden.has('a')).toBe(false);
    const opened = open(state, 'a');
    expect(arrive(opened, 'a')).toBe(opened);
  });

  it('clears everything for the messages page and trims windows for a phone', () => {
    let state = ['a', 'b'].reduce(arrive, EMPTY_BUBBLES);
    state = open(open(state, 'a'), 'b');
    expect(bubblesReducer(state, { type: 'limitWindows', max: 1 }).windows).toEqual(['b']);
    const cleared = bubblesReducer(state, { type: 'clearAll' });
    expect(cleared).toMatchObject({ bubbles: [], windows: [] });
    expect(bubblesReducer(cleared, { type: 'clearAll' })).toBe(cleared);
  });
});
