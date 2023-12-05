import React, { useContext } from "react";
import "./comments.scss";
import { comments } from "../../mocks";
import { AuthContext } from "../../context/authContext";
import defImg from '../../assets/IMG_3301 (2).jpg'

const Comments = () => {
  const context = useContext(AuthContext);

  return (
    <div className="comments">
      <div className="write">
        <img src={context?.user?.profile_picture || defImg} alt="" />
        <input type="text" placeholder="Write a comment..." />
        <button>Send</button>
      </div>
      {comments.map(({ id, content, name, userId, profilePic }) => {
        return (
          <>
            <div className="comment" key={id}>
              <img src={profilePic} alt="" />
              <div className="info">
                <span>{name}</span>
                <p>{content}</p>
              </div>
              <span className="date">3h. ago</span>
            </div>
            <hr />
          </>
        );
      })}
    </div>
  );
};

export default Comments;
