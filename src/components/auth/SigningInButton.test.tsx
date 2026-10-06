import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SigningInButton } from './SigningInButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('sign-in retry availability', () => {
  it('prevents another attempt throughout a slow in-flight sign-in', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    render(<SigningInButton className="" onTimeout={retry} isPending />);
    act(() => vi.advanceTimersByTime(120_000));
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(retry).not.toHaveBeenCalled();
  });

  it('allows recovery only after an idle timeout and cancels it when sign-in resumes', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const { rerender } = render(<SigningInButton className="" onTimeout={retry} isPending />);
    act(() => vi.advanceTimersByTime(30_000));
    rerender(<SigningInButton className="" onTimeout={retry} isPending={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByRole('button')).toBeEnabled();
    rerender(<SigningInButton className="" onTimeout={retry} isPending />);
    expect(screen.getByRole('button')).toBeDisabled();
    act(() => vi.advanceTimersByTime(120_000));
    expect(screen.getByRole('button')).toBeDisabled();
    expect(retry).not.toHaveBeenCalled();
  });
});