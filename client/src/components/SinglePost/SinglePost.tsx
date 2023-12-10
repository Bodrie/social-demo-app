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
  id: number,
  name: string;
  userId: number;
  profilePic: string;
  content: string;
  contentImg: string | null;
  createdAt: string | null;
}

const SinglePost = ({
  id,
  name,
  userId,
  profilePic,
  content,
  contentImg,
  createdAt,
}: SinglePostProps) => {
  const API = process.env.REACT_APP_API;
  const imgSrc = `${API}/upload/${contentImg}`;
  const liked = false;
  const [commentsSection, setCommentsSection] = useState(false);
  const [numberOfComments, setNumberOfComments] = useState(0);
  const [fit, setFit] = useState("cover");

  const handleImgFit = () => {
    setFit(fit === "cover" ? "contain" : "cover");
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
            {liked ? <FavoriteOutlined /> : <FavoriteBorderOutlined />} 4
          </div>
          <div
            className="item"
            onClick={() => setCommentsSection(!commentsSection)}
          >
            <TextsmsOutlined />{numberOfComments}
          </div>
          <div className="item">
            <ShareOutlined />
          </div>
        </div>
        {commentsSection && <Comments postId={id} setNumberOfComments={setNumberOfComments} />}
      </div>
    </div>
  );
};

export default SinglePost;
