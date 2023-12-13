export type ActivityType = {
  user: string;
  profilePic: string;
  activity: ActivityTypes;
  createdAt?: string;
  userId?: number;
};

export type ActivityTypes =
  | "commented on a post."
  | "created a post."
  | "just registred."
  | "updated profile picture."
  | "liked post.";
