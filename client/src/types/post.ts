export type Post = {
  id: number;
  name: string;
  userId: number;
  profilePic: string;
  content: string;
  contentImg: string | null;
  createdAt: string | null;
  likes: string;
};

export type PostCreate = {
  content: string;
  contentImg?: string;
};

export type PostInteraction = {
  userId: number;
  postId: number;
  action?: PostAction
};

export type PostAction = "like" | "dislike";
