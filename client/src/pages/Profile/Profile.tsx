import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getUserById } from "../../services/axios";
import { Posts } from "../../components";
import { User } from "../../types";
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

const Profile = () => {
  const authCtx = useContext(AuthContext);
  const [queryParameters] = useSearchParams();
  const userId = queryParameters.get("id") as string;
  const [user, setUser] = useState<User>(null);

  const { isLoading, error, data } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => getUserById(userId),
  });

  const isCurrentUser = user?.id === authCtx?.user?.id;

  useEffect(() => {
    if (data) {
      setUser(data[0]);
    }
  }, [data]);

  return (
    <div className="profile">
      <div className="pictures">
        <img
          src={user?.cover_picture}
          alt="Cover picture of user profile"
          className="cover"
        />
        <img
          src={user?.profile_picture}
          alt="Main picture of user profile"
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
            <span>
              {user?.name}
            </span>
            <span>({user?.username})</span>
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
            {!isCurrentUser && <button>Follow</button>}
          </div>
          <div className="right">
            {isCurrentUser ? <MoreVert /> : <EmailOutlined />}
          </div>
        </div>
        <Posts />
      </div>
    </div>
  );
};

export default Profile;
