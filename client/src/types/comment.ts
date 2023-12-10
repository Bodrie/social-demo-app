export type Comment = {
  id: number;
  content: string;
  name: string;
  userId: number;
  profilePic: string;
  createdAt: string;
};

export type CommentCreate = {
  content: string;
  postId: number;
}
