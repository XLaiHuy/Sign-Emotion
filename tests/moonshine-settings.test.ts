import { expect, it } from 'vitest';
import { defaultSettings, settingsSchema } from '../src/shared/contracts';

it('keeps PhoWhisper as default and migrates stored settings without an ASR profile', () => {
  const { asrProfile: _oldProfile, ...olderSettings } = defaultSettings;
  expect(settingsSchema.parse(olderSettings).asrProfile).toBe('product');
  expect(defaultSettings.asrProfile).toBe('product');
});

it('accepts only the explicit experimental Vietnamese streaming profile', () => {
  expect(
    settingsSchema.parse({ ...defaultSettings, asrProfile: 'moonshine-streaming-vi-research' })
      .asrProfile,
  ).toBe('moonshine-streaming-vi-research');
  expect(
    settingsSchema.safeParse({ ...defaultSettings, asrProfile: 'unknown-model' }).success,
  ).toBe(false);
});
