import React, { useContext } from "react";
import "./profile.scss";
import { AuthContext } from "../../context/authContext";
import defImg from "../../assets/IMG_3301 (2).jpg";
import defImg2 from "../../assets/placeholder1920x1000.png";
import {
  FacebookTwoTone,
  Instagram,
  Twitter,
  LinkedIn,
  Pinterest,
  Place,
  Language,
  EmailOutlined,
  MoreVert,
} from "@mui/icons-material";
import "./profile.scss";
import { Posts } from "../../components";

const Profile = () => {
  const context = useContext(AuthContext);

  return (
    <div className="profile">
      <div className="pictures">
        <img
          src={context?.user?.cover_picture || defImg2}
          alt=""
          className="cover"
        />
        <img
          src={context?.user?.profile_picture || defImg}
          alt=""
          className="main"
        />
      </div>
      <div className="profile-container">
        <div className="general-info">
          <div className="left">
            <a href="">
              <FacebookTwoTone />
            </a>
            <a href="">
              <Instagram />
            </a>
            <a href="">
              <Twitter />
            </a>
            <a href="">
              <LinkedIn />
            </a>
            <a href="">
              <Pinterest />
            </a>
          </div>
          <div className="center">
            <span>Bodrie Kirov</span>
            <div className="person-info">
              <div className="item">
                <Place />
                <span>Bulgaria</span>
              </div>
              <div className="item">
                <Language />
                <span>Some Site Name</span>
              </div>
            </div>
            <button>Follow</button>
          </div>
          <div className="right">
            <EmailOutlined />
            <MoreVert />
          </div>
        </div>
        <Posts />
      </div>
    </div>
  );
};

export default Profile;
