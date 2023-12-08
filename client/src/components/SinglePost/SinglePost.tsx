import React, { useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import {
  MoreHoriz,
  FavoriteBorderOutlined,
  FavoriteOutlined,
  TextsmsOutlined,
  ShareOutlined,
} from "@mui/icons-material";
import { Comments } from "../../components";
import "./singlePost.scss";

interface SinglePostProps {
  name: string;
  userId: number;
  profilePic: string;
  content: string;
  contentImg: string | null;
  createdAt: string | null;
}

const SinglePost = ({
  name,
  userId,
  profilePic,
  content,
  contentImg,
  createdAt,
}: SinglePostProps) => {
  const liked = false;
  const [commentsSection, setCommentsSection] = useState(false);

  return (
    <div className="post">
      <div className="container">
        <div className="user">
          <div className="user-info">
            <Link to={`/profile?id=${userId}`}>
              <img src={profilePic} alt="" />
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
          {contentImg && <img src={contentImg} alt="" />}
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
