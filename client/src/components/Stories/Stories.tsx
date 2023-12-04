import React, { useContext } from "react";
import imgSrc from "../../assets/story-placeholder.webp";
import defImgSrc from "../../assets/images.png";
import { AuthContext } from "../../context/authContext";
import { ControlPoint } from "@mui/icons-material";
import "./stories.scss";

const Stories = () => {
  const context = useContext(AuthContext);
  const stories = [
    { id: 1, name: "asd", img: imgSrc },
    { id: 2, name: "222", img: imgSrc },
    { id: 3, name: "333", img: imgSrc },
  ];
  return (
    <div className="stories">
      <div className="story">
        <img
          src={context?.user?.profile_picture || defImgSrc}
          alt="add story"
        />
        <span>{context?.user?.name}</span>
        <ControlPoint className="add" />
      </div>
      {stories.map(({ id, img, name }) => {
        return (
          <div key={id} className="story">
            <img src={img} alt="story of some user" />
            <span>{name}</span>
          </div>
        );
      })}
    </div>
  );
};

export default Stories;
