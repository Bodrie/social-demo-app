import React, { useContext } from "react";
import "./profile.scss";
import { AuthContext } from "../../context/authContext";
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
  const authCtx = useContext(AuthContext);

  return (
    <div className="profile">
      <div className="pictures">
        <img
          src={authCtx?.user?.cover_picture}
          alt="cover picture of user profile"
          className="cover"
        />
        <img
          src={authCtx?.user?.profile_picture}
          alt="main picture of user profile"
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
            <span>{authCtx?.user?.name} ({authCtx?.user?.username})</span>
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
