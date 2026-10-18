import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Feedback } from '../src/features/feedback/Feedback';
import { db } from '../src/infrastructure/storage/database';
beforeEach(async () => {
  await db.reports.clear();
});
afterEach(async () => {
  cleanup();
  await db.reports.clear();
});
it('defaults to explicit local storage consent and actually deletes its content', async () => {
  render(
    <Feedback
      metrics={{
        durationMs: 1000,
        processedFrames: 5,
        invalidFrames: 0,
        uncertainFrames: 0,
        hapticCount: 0,
        p50Ms: 10,
        p95Ms: 20,
      }}
      onNotice={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: 'Lưu trên thiết bị' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: /Điều bạn muốn chia sẻ/ }), {
    target: { value: 'Local private comment' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /Tôi đồng ý lưu/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu trên thiết bị' }));
  await waitFor(() => expect(screen.getByText('Chỉ lưu trên thiết bị')).toBeInTheDocument());
  const [row] = await db.reports.toArray();
  expect(row.deliveryConsent).toBe('local-only');
  expect(row.destination).toBeUndefined();
  expect(row.report?.feedback.comment).toBe('Local private comment');
  fireEvent.click(screen.getByRole('button', { name: 'Xóa trên thiết bị' }));
  await waitFor(async () => expect(await db.reports.count()).toBe(0));
});
