import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Comment, CommentCreate } from "../../types";
import { getPostComments, addComment, addActivity } from "../../services/axios";
import moment from "moment";
import "./comments.scss";

interface CommentsProps {
  postId: number;
}

const Comments = ({ postId }: CommentsProps) => {
  const queryClient = useQueryClient();
  const authCtx = useContext(AuthContext);
  const [content, setContentValue] = useState("");

  const { isLoading, error, data } = useQuery<Comment[]>({
    queryKey: ["comments"],
    queryFn: () => getPostComments(postId),
  });

  const mutation = useMutation({
    mutationFn: (newComment: CommentCreate) => {
      return (
        addComment(newComment),
        addActivity({
          profilePic: authCtx?.user?.profile_picture!,
          user: authCtx?.user?.name!,
          activity: "commented on a post.",
          userId: authCtx?.user?.id,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["commentsCount"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setContentValue("");
    },
  });

  const handleCommentShare = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    mutation.mutate({ content, postId });
  };

  return (
    <div className="comments">
      <hr />
      <div className="write">
        <img src={authCtx?.user?.profile_picture} alt="Current user" />
        <input
          type="text"
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContentValue(e.target.value)}
        />
        <button onClick={handleCommentShare}>Send</button>
      </div>
      {isLoading
        ? "Loading..."
        : data?.map(({ id, content, name, profilePic, createdAt }) => {
            return (
              <div key={id}>
                <div className="comment">
                  <img src={profilePic} alt="User comment" />
                  <div className="info">
                    <span>{name}</span>
                    <p>{content}</p>
                  </div>
                  <span className="date">{moment(createdAt).fromNow()}</span>
                </div>
                <hr />
              </div>
            );
          })}
    </div>
  );
};

export default Comments;
