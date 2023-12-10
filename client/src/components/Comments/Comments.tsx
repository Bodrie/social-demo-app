import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Comment, CommentCreate } from "../../types";
import { getPostComments, addComment } from "../../services/axios";
import moment from "moment";
import "./comments.scss";

interface CommentsProps {
  postId: number;
  setNumberOfComments: (comments: number) => void;
}

const Comments = ({ postId, setNumberOfComments }: CommentsProps) => {
  const queryClient = useQueryClient();
  const context = useContext(AuthContext);
  const [content, setContentValue] = useState("");

  const { isLoading, error, data } = useQuery<Comment[]>({
    queryKey: ["comments"],
    queryFn: () => getPostComments(postId),
  });

  const mutation = useMutation({
    mutationFn: (newComment: CommentCreate) => {
      return addComment(newComment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      setContentValue("");
    },
  });

  const handleCommentShare = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    mutation.mutate({ content, postId });
  };

  useEffect(() => {
    setNumberOfComments(data?.length || 0);
  }, [data]);

  return (
    <div className="comments">
      <hr />
      <div className="write">
        <img src={context?.user?.profile_picture} alt="Current user" />
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
