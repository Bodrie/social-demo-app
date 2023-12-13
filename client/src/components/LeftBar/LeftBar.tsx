import React from "react";
import { PeopleAlt } from "@mui/icons-material";
import imgSrc from "../../assets/images.png";
import "./leftBar.scss";
import { Link } from "react-router-dom";

const LeftBar = () => {
  return (
    <div className="left-bar">
      <div className="container">
        <div className="section">
          <Link to={"/users"} className="item">
            <PeopleAlt className="icon" />
            <span>All Users</span>
          </Link>

          <div className="item">
            <img src={imgSrc} alt="Menu item 2" />
            <span>Menu item 2</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="Menu item 3" />
            <span>Menu item 3</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="Menu item 4" />
            <span>Menu item 4</span>
          </div>
        </div>
        <hr />
        <div className="section">
          <span>Section name</span>
          <div className="item">
            <img src={imgSrc} alt="Menu item 1" />
            <span>Menu item 1</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="Menu item 2" />
            <span>Menu item 2</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="Menu item 3" />
            <span>Menu item 3</span>
          </div>
          <div className="item">
            <img src={imgSrc} alt="Menu item 4" />
            <span>Menu item 4</span>
          </div>
        </div>
        <hr />
      </div>
    </div>
  );
};

export default LeftBar;
