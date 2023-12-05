import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MoreHoriz,
  FavoriteBorderOutlined,
  FavoriteOutlined,
  TextsmsOutlined,
  ShareOutlined,
} from "@mui/icons-material";
import "./singlePost.scss";
import { Comments } from "../../components";

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
  const [commentsSection, setCommentsSection] = useState(false);

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
            {liked ? <FavoriteOutlined /> : <FavoriteBorderOutlined />} 4
          </div>
          <div
            className="item"
            onClick={() => setCommentsSection(!commentsSection)}
          >
            <TextsmsOutlined />9
          </div>
          <div className="item">
            <ShareOutlined />
          </div>
        </div>
        {commentsSection && <Comments />}
      </div>
    </div>
  );
};

export default SinglePost;