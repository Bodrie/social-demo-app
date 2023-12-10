import React, { useContext } from "react";
import defImgSrc from "../../assets/images.png";
import { AuthContext } from "../../context/authContext";
import { ControlPoint } from "@mui/icons-material";
import { stories } from "../../mocks";
import "./stories.scss";

const Stories = () => {
  const context = useContext(AuthContext);
  return (
    <div className="stories">
      <div className="story">
        <img
          src={context?.user?.profile_picture || defImgSrc}
          alt="Add story"
        />
        <span>{context?.user?.name}</span>
        <ControlPoint className="add" />
      </div>
      {stories.map(({ id, img, name }) => {
        return (
          <div key={id} className="story">
            <img src={img} alt="Story of some user" />
            <span>{name}</span>
          </div>
        );
      })}
    </div>
  );
};

export default Stories;
