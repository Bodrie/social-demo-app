import type {
  AchievementDefinition,
  AchievementIcon,
  AchievementTier,
} from '@beso/shared/achievements';
import { cn } from 'cn';
import {
  ApertureIcon,
  AtSignIcon,
  BadgeCheckIcon,
  BookmarkIcon,
  CalendarHeartIcon,
  CameraIcon,
  CarIcon,
  CatIcon,
  ClockIcon,
  CompassIcon,
  DoorOpenIcon,
  EraserIcon,
  FingerprintIcon,
  FlagIcon,
  FlameIcon,
  GhostIcon,
  HandHeartIcon,
  HandshakeIcon,
  HashIcon,
  HeartIcon,
  HeartPulseIcon,
  HouseIcon,
  IdCardIcon,
  ImageIcon,
  ImagesIcon,
  LandmarkIcon,
  LaughIcon,
  LayersIcon,
  type LucideIcon,
  MailPlusIcon,
  MedalIcon,
  MegaphoneIcon,
  MessageCircleDashedIcon,
  MessageCircleHeartIcon,
  MessageCircleIcon,
  MessageCircleMoreIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  MoonStarIcon,
  NetworkIcon,
  NotebookPenIcon,
  OrbitIcon,
  PaletteIcon,
  PartyPopperIcon,
  PenLineIcon,
  QuoteIcon,
  RabbitIcon,
  RadioIcon,
  Repeat2Icon,
  ReplyIcon,
  RulerIcon,
  SailboatIcon,
  ScrollTextIcon,
  Share2Icon,
  ShovelIcon,
  SmartphoneIcon,
  SmileIcon,
  SmilePlusIcon,
  SofaIcon,
  SparklesIcon,
  SpeechIcon,
  StarIcon,
  SunriseIcon,
  TimerIcon,
  TrendingUpIcon,
  TrophyIcon,
  UserRoundPlusIcon,
  UsersIcon,
  UsersRoundIcon,
  UtensilsCrossedIcon,
  ZapIcon,
} from 'lucide-react';

/**
 * One icon per badge. Prefer icons the first paint does not use: one it shares (Repeat2, the
 * repost button's) is split into a chunk of its own, which costs the first paint (F2b moved
 * Night owl off Moon and Crowd off UserPlus for that).
 */
const ICONS: Record<AchievementIcon, LucideIcon> = {
  camera: CameraIcon,
  image: ImageIcon,
  'notebook-pen': NotebookPenIcon,
  users: UsersIcon,
  'pen-line': PenLineIcon,
  'message-square': MessageSquareIcon,
  'badge-check': BadgeCheckIcon,
  images: ImagesIcon,
  hash: HashIcon,
  'at-sign': AtSignIcon,
  'repeat-2': Repeat2Icon,
  quote: QuoteIcon,
  'message-circle': MessageCircleIcon,
  'users-round': UsersRoundIcon,
  heart: HeartIcon,
  'smile-plus': SmilePlusIcon,
  bookmark: BookmarkIcon,
  'id-card': IdCardIcon,
  smartphone: SmartphoneIcon,
  'scroll-text': ScrollTextIcon,
  'messages-square': MessagesSquareIcon,
  reply: ReplyIcon,
  'hand-heart': HandHeartIcon,
  smile: SmileIcon,
  aperture: ApertureIcon,
  'message-circle-more': MessageCircleMoreIcon,
  compass: CompassIcon,
  megaphone: MegaphoneIcon,
  network: NetworkIcon,
  trophy: TrophyIcon,
  'calendar-heart': CalendarHeartIcon,
  flag: FlagIcon,
  landmark: LandmarkIcon,
  medal: MedalIcon,
  'user-round-plus': UserRoundPlusIcon,
  'heart-pulse': HeartPulseIcon,
  flame: FlameIcon,
  speech: SpeechIcon,
  star: StarIcon,
  'share-2': Share2Icon,
  radio: RadioIcon,
  'trending-up': TrendingUpIcon,
  handshake: HandshakeIcon,
  zap: ZapIcon,
  orbit: OrbitIcon,
  sailboat: SailboatIcon,
  'utensils-crossed': UtensilsCrossedIcon,
  'mail-plus': MailPlusIcon,
  'moon-star': MoonStarIcon,
  sunrise: SunriseIcon,
  sparkles: SparklesIcon,
  clock: ClockIcon,
  sofa: SofaIcon,
  'party-popper': PartyPopperIcon,
  rabbit: RabbitIcon,
  cat: CatIcon,
  ghost: GhostIcon,
  'message-circle-heart': MessageCircleHeartIcon,
  house: HouseIcon,
  laugh: LaughIcon,
  ruler: RulerIcon,
  car: CarIcon,
  timer: TimerIcon,
  shovel: ShovelIcon,
  'door-open': DoorOpenIcon,
  eraser: EraserIcon,
  layers: LayersIcon,
  palette: PaletteIcon,
  'message-circle-dashed': MessageCircleDashedIcon,
  fingerprint: FingerprintIcon,
};

/** The tier tokens of `index.css`; a badge without tiers wears the accent. */
const TIER_CLASSES: Record<AchievementTier | 'plain', string> = {
  bronze: 'bg-badge-bronze text-badge-bronze-foreground',
  silver: 'bg-badge-silver text-badge-silver-foreground',
  gold: 'bg-badge-gold text-badge-gold-foreground',
  platinum: 'bg-badge-platinum text-badge-platinum-foreground',
  plain: 'bg-accent text-accent-foreground',
};

const SIZES = {
  sm: ['size-8', 'size-4'],
  md: ['size-10', 'size-5'],
  lg: ['size-14', 'size-7'],
} as const;

type MedallionProps = {
  achievement: Pick<AchievementDefinition, 'icon' | 'tier'>;
  /** Not earned yet: greyed, with a dashed rim. */
  locked?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
};

/** A badge's picture: its lucide icon in a circle of its tier's colours. Decorative. */
export function Medallion({ achievement, locked = false, size = 'md', className }: MedallionProps) {
  const Icon = ICONS[achievement.icon];
  const [circle, icon] = SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        circle,
        locked
          ? 'bg-muted text-muted-foreground border-muted-foreground/40 border border-dashed'
          : TIER_CLASSES[achievement.tier ?? 'plain'],
        className,
      )}
    >
      <Icon className={icon} />
    </span>
  );
}
