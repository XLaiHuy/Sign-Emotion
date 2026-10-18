import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConversationSaveControl } from '../src/features/conversation/ConversationSaveControl';
import { ConversationPersistence } from '../src/infrastructure/storage/conversationPersistence';
import type { ConversationVault } from '../src/infrastructure/storage/vault';
import type { useVault } from '../src/features/history/useVault';
afterEach(cleanup);
it('lets the user unlock in place and explicitly continue without saving', async () => {
  const vault = {
    unlocked: false,
    exists: async () => true,
    unlock: vi.fn(async () => {}),
    create: vi.fn(),
  } as unknown as ConversationVault;
  const store = {
    vault,
    persistence: new ConversationPersistence(vault),
    saveState: 'locked',
    revision: 0,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useVault>;
  const onSkip = vi.fn(),
    onChange = vi.fn();
  render(
    <ConversationSaveControl
      store={store}
      enabled
      running={false}
      skip={false}
      onSkip={onSkip}
      onChange={onChange}
    />,
  );
  await screen.findByLabelText('Mật khẩu lịch sử');
  fireEvent.change(screen.getByLabelText('Mật khẩu lịch sử'), {
    target: { value: 'password-local' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mở khóa để lưu' }));
  await waitFor(() => expect(vault.unlock).toHaveBeenCalledWith('password-local'));
  expect(store.refresh).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục không lưu phiên này' }));
  expect(onSkip).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByLabelText('Lưu hội thoại trên thiết bị'));
  expect(onChange).toHaveBeenCalledWith(false);
});
