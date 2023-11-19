import React from "react";
import "./rightBar.scss";
import imgSrc from "../../assets/images.png";

const RightBar = () => {
  return (
    <div className="right-bar">
      <div className="container">
        <div className="item">
          <span>Suggestions for you</span>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
            </div>
            <div className="buttons">
              <button>Follow</button>
              <button>Dismiss</button>
            </div>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
            </div>
            <div className="buttons">
              <button>Follow</button>
              <button>Dismiss</button>
            </div>
          </div>
        </div>
        <div className="item">
          <span>Latest activities</span>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <p>Changed their profile picture</p>
            </div>
            <span className="when">1 min ago</span>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <p>Changed their profile picture</p>
            </div>
            <span className="when">1 min ago</span>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <p>Changed their profile picture</p>
            </div>
            <span className="when">1 min ago</span>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <p>Changed their profile picture</p>
            </div>
            <span className="when">1 min ago</span>
          </div>
        </div>
        <div className="item">
          <span>Online friends</span>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <div className="online"/>
            </div>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <div className="online"/>
            </div>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <div className="online"/>
            </div>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="" />
              <span>User Name</span>
              <div className="online"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightBar;
