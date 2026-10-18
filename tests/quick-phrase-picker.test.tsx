import { afterEach, expect, it, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { QuickPhrasePicker } from '../src/features/conversation/QuickPhrasePicker';

afterEach(cleanup);

it('renders toggle button and expands 100 phrases on click', () => {
  const handleSelect = vi.fn();
  render(<QuickPhrasePicker onSelectPhrase={handleSelect} />);

  const toggleBtn = screen.getByRole('button', {
    name: /Khám phá câu mẫu/i,
  });
  expect(toggleBtn).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).toBeNull();

  // Expand
  fireEvent.click(toggleBtn);
  expect(screen.getByRole('tablist')).toBeInTheDocument();

  // Check tabs
  expect(screen.getByText(/Giao tiếp/)).toBeInTheDocument();
  expect(screen.getByText(/Y tế & Sức khỏe/)).toBeInTheDocument();
  expect(screen.getByText(/Đời sống hàng ngày/)).toBeInTheDocument();

  // Find pilot phrase chip SENT064
  const pilotChip = screen.getByRole('button', {
    name: /Xin viết ra giấy giúp tôi/i,
  });
  expect(pilotChip).toBeInTheDocument();

  // Click phrase chip
  fireEvent.click(pilotChip);
  expect(handleSelect).toHaveBeenCalledWith('Xin viết ra giấy giúp tôi.');
});
