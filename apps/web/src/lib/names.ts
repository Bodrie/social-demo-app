/** Up to two capital letters from the first two words of a name, for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** The first word of a name, for friendly prompts ("What's on your mind, Alice?"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
