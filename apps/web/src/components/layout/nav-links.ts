import {
  ActivityIcon,
  HomeIcon,
  type LucideIcon,
  MessageCircleIcon,
  UsersIcon,
} from 'lucide-react';

export type NavLinkItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

export const NAV_LINKS: NavLinkItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/users', label: 'People', icon: UsersIcon },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/messages', label: 'Messages', icon: MessageCircleIcon },
];
