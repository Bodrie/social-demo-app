/** Tailwind size classes shared by every round avatar-like element. */
export const AVATAR_SIZE = { sm: 'size-8', md: 'size-9', lg: 'size-10', xl: 'size-24' } as const;
export type AvatarSize = keyof typeof AVATAR_SIZE;
