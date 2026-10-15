import EmojiPicker, { type EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';

type EmojiPickerPanelProps = { dark: boolean; onPick: (emoji: string) => void };

/**
 * Loaded lazily (see EmojiPickerButton): the picker and its emoji data only reach
 * the browser once someone opens it. Native glyphs keep it free of image CDNs.
 */
export default function EmojiPickerPanel({ dark, onPick }: EmojiPickerPanelProps) {
  return (
    <EmojiPicker
      onEmojiClick={(data: EmojiClickData) => onPick(data.emoji)}
      theme={dark ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      lazyLoadEmojis
      skinTonesDisabled
      previewConfig={{ showPreview: false }}
      searchPlaceholder="Search emoji"
      width={320}
      height={360}
    />
  );
}
