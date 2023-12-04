import React from "react";
import { Link } from "react-router-dom";
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
  contentImg: string;
}

const SinglePost = ({
  id,
  name,
  userId,
  profilePic,
  content,
  contentImg,
}: SinglePostProps) => {
  const liked = false;

  return (
    <div className="post">
      <div className="container">
        <div className="user">
          <div className="user-info">
            <img src={profilePic} alt="" />
            <div className="details">
              <Link to={`/profile/${userId}`}>
                <span className="name">{name}</span>
              </Link>
              <span className="date">7 min ago</span>
            </div>
          </div>
          <MoreHoriz />
        </div>
        <div className="content">
          <p>{content}</p>
          <img src={contentImg} alt="" />
        </div>
        <div className="info">
          <div className="item">
            {liked ? <FavoriteOutlined /> : <FavoriteBorderOutlined />} 4 Likes
          </div>
          <div className="item">
            <TextsmsOutlined /> 9 Comments
          </div>
          <div className="item">
            <ShareOutlined />
            Share
          </div>
        </div>
      </div>
    </div>
  );
};

export default SinglePost;
