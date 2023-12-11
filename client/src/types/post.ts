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

export type PostLike = {
  userId: number;
  postId: number;
};
