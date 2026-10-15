import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  it('settles on the latest value after the delay', async () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
        initialProps: { value: 'a' },
      });
      rerender({ value: 'ab' });
      rerender({ value: 'abc' });
      expect(result.current).toBe('a');
      await act(() => vi.advanceTimersByTime(299));
      expect(result.current).toBe('a');
      await act(() => vi.advanceTimersByTime(1));
      expect(result.current).toBe('abc');
    } finally {
      vi.useRealTimers();
    }
  });
});
