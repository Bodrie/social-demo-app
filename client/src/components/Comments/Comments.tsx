import React, { useContext } from "react";
import { comments } from "../../mocks";
import { AuthContext } from "../../context/authContext";
import "./comments.scss";

const Comments = () => {
  const context = useContext(AuthContext);

  return (
    <div className="comments">
      <hr />
      <div className="write">
        <img src={context?.user?.profile_picture} alt="Current user" />
        <input type="text" placeholder="Write a comment..." />
        <button>Send</button>
      </div>
      {comments.map(({ id, content, name, userId, profilePic }) => {
        return (
          <div key={id}>
            <div className="comment">
              <img src={profilePic} alt="User comment" />
              <div className="info">
                <span>{name}</span>
                <p>{content}</p>
              </div>
              <span className="date">3h. ago</span>
            </div>
            <hr />
          </div>
        );
      })}
    </div>
  );
};

export default Comments;
