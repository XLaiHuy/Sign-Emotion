import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TestLab } from '../src/features/lab/TestLab';
import { defaultSettings } from '../src/shared/contracts';

vi.mock('../src/features/lab/SynchronizedVideoTest', () => ({ SynchronizedVideoTest: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('starts disabled, exposes five independent choices locally, and never persists the choice', () => {
  vi.stubGlobal('location', { hostname: 'localhost' });
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const props = {
    settings: Object.freeze({ ...defaultSettings }),
    onNotice: vi.fn(),
    onCandidate: vi.fn(),
  };
  const view = render(<TestLab {...props} />);
  const enable = screen.getByLabelText('Thử tiền xử lý B2 trên localhost');
  expect(enable).not.toBeChecked();
  fireEvent.click(enable);
  const select = screen.getByLabelText(/Cấu hình cho lượt này/);
  expect(select.querySelectorAll('option')).toHaveLength(5);
  fireEvent.change(select, { target: { value: 'expression-050' } });
  expect(select).toHaveValue('expression-050');
  expect(props.settings.threshold).toBe(0.55);
  expect(storage).not.toHaveBeenCalled();
  view.unmount();
  render(<TestLab {...props} />);
  expect(screen.getByLabelText('Thử tiền xử lý B2 trên localhost')).not.toBeChecked();
});
it('hides experiments on the public host', () => {
  vi.stubGlobal('location', { hostname: 'sign-emotion.vercel.app' });
  render(<TestLab settings={defaultSettings} onNotice={() => {}} onCandidate={() => {}} />);
  expect(screen.queryByLabelText('Thử tiền xử lý B2 trên localhost')).toBeNull();
});
