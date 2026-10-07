import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SigningInButton } from './SigningInButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('sign-in retry availability', () => {
  it('withholds retry during a slow in-flight sign-in (under 90s)', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    render(<SigningInButton className="" onTimeout={retry} isPending />);
    act(() => vi.advanceTimersByTime(80_000));
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(retry).not.toHaveBeenCalled();
  });

  it('offers retry after 90s even if the sign-in never finishes', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    render(<SigningInButton className="" onTimeout={retry} isPending />);
    act(() => vi.advanceTimersByTime(90_000));
    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers retry after 20s when idle', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    render(<SigningInButton className="" onTimeout={retry} />);
    act(() => vi.advanceTimersByTime(19_000));
    expect(screen.getByRole('button')).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('button')).toBeEnabled();
  });
});
