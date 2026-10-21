import { act, fireEvent, render, screen } from '@testing-library/react';
import { LongPressArea } from './long-press-area';

const touch = (overrides: Partial<PointerEventInit> = {}): PointerEventInit => ({
  pointerType: 'touch',
  isPrimary: true,
  button: 0,
  clientX: 10,
  clientY: 10,
  ...overrides,
});

/** Long enough for the hold, under fake timers. */
const settle = () => {
  act(() => {
    vi.advanceTimersByTime(500);
  });
};

describe('LongPressArea', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once a touch is held and swallows the click the release would give a link', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <LongPressArea onLongPress={onLongPress}>
        <a href="/elsewhere" onClick={onClick}>
          a link
        </a>
      </LongPressArea>,
    );
    const link = screen.getByRole('link', { name: 'a link' });
    const area = link.parentElement!;

    fireEvent.pointerDown(area, touch());
    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(area);

    fireEvent.pointerUp(area);
    fireEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
    // The next tap is an ordinary click again.
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is cancelled by a lift, a scroll or a mouse, and leaves controls to themselves', () => {
    const onLongPress = vi.fn();
    render(
      <LongPressArea onLongPress={onLongPress}>
        <p>some text</p>
        <button type="button">menu</button>
      </LongPressArea>,
    );
    const area = screen.getByText('some text').parentElement!;
    fireEvent.pointerDown(area, touch());
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerUp(area);
    settle();
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.pointerDown(area, touch());
    fireEvent.pointerMove(area, touch({ clientY: 40 }));
    settle();
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.pointerDown(area, touch({ pointerType: 'mouse' }));
    settle();
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'menu' }), touch());
    settle();
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.pointerDown(area, touch());
    fireEvent.pointerMove(area, touch({ clientY: 14 }));
    settle();
    expect(onLongPress).toHaveBeenCalledExactlyOnceWith(area);
  });
});
