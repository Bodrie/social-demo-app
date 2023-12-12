import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Comments } from "../../components";
import { likePost, dislikePost } from "../../services/axios";
import { PostLike } from "../../types";
import moment from "moment";
import {
  MoreHoriz,
  FavoriteBorderOutlined,
  FavoriteOutlined,
  TextsmsOutlined,
  ShareOutlined,
} from "@mui/icons-material";
import "./singlePost.scss";

interface SinglePostProps {
  id: number;
  name: string;
  userId: number;
  profilePic: string;
  content: string;
  contentImg: string | null;
  createdAt: string | null;
  likes: string;
}

const SinglePost = ({
  id,
  name,
  userId,
  profilePic,
  content,
  contentImg,
  createdAt,
  likes,
}: SinglePostProps) => {
  const API = process.env.REACT_APP_API;
  const imgSrc = `${API}/upload/${contentImg}`;
  const authCtx = useContext(AuthContext);
  const [commentsSection, setCommentsSection] = useState(false);
  const [fit, setFit] = useState("cover");
  const queryClient = useQueryClient();

  const handleImgFit = () => {
    setFit(fit === "cover" ? "contain" : "cover");
  };

  const likesToArray = likes.split(",");

  const mutationLike = useMutation({
    mutationFn: (like: PostLike) => {
      return likePost(like);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    mutationLike.mutate({ userId: authCtx?.user?.id!, postId: id });
  };

  const mutationDislike = useMutation({
    mutationFn: (dislike: PostLike) => {
      return dislikePost(dislike);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
  const handleDislike = (e: React.MouseEvent) => {
    e.preventDefault();
    mutationDislike.mutate({ userId: authCtx?.user?.id!, postId: id });
  };

  return (
    <div className="post">
      <div className="container">
        <div className="user">
          <div className="user-info">
            <Link to={`/profile?id=${userId}`}>
              <img src={profilePic} alt="User" />
            </Link>
            <div className="details">
              <Link to={`/profile?id=${userId}`}>
                <span className="name">{name}</span>
              </Link>
              <span className="date">{moment(createdAt).fromNow()}</span>
            </div>
          </div>
          <MoreHoriz />
        </div>
        <div className="content">
          <p>{content}</p>
          {contentImg && (
            <img
              className={`content-img ${fit}`}
              src={imgSrc}
              alt="User post content"
              onClick={handleImgFit}
            />
          )}
        </div>
        <div className="info">
          <div className="item">
            {likesToArray.includes(authCtx?.user?.id.toString()!) ? (
              <FavoriteOutlined className="liked" onClick={handleDislike} />
            ) : (
              <FavoriteBorderOutlined onClick={handleLike} />
            )}
            {likesToArray.length - 1}
          </div>
          <div
            className="item"
            onClick={() => setCommentsSection(!commentsSection)}
          >
            <TextsmsOutlined />
          </div>
          <div className="item">
            <ShareOutlined />
          </div>
        </div>
        {commentsSection && <Comments postId={id} />}
      </div>
    </div>
  );
};

export default SinglePost;
