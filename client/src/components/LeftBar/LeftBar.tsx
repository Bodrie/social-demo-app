import React from "react";
import "./leftBar.scss";
import imgSrc from "../../assets/images.png";

const LeftBar = () => {
  return (
    <div className="left-bar">
      <div className="container">
        <div className="section">
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 1</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 2</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 3</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 4</span>
          </div>
        </div>
        <hr />
        <div className="section">
          <span>Section name</span>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 1</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 2</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 3</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="" />
            <span>Menu item 4</span>
          </div>
        </div>
        <hr />
      </div>
    </div>
  );
};

export default LeftBar;
