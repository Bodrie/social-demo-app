import React from "react";
import { AddCircleOutline } from "@mui/icons-material";
import "./updateProfile.scss";
import { User } from "../../types";

interface UpaderProfile {
  user: User;
}

const UpdateProfile = ({ user }: UpaderProfile) => {
  return (
    <div className="update-profile">
      <div className="pictures">
        <div className="item">
          <img src={user.profile_picture} alt="profile pic" />
          <label htmlFor="changeProfilePic">
            <AddCircleOutline />
            <span>Change</span>
          </label>
          <input id="changeProfilePic" type="file" />
        </div>
        <div className="item">
          <img src={user.cover_picture} alt="cover pic" />
          <label htmlFor="changeCoverPic">
            <AddCircleOutline />
            <span>Change</span>
          </label>
          <input id="changeCoverPic" type="file" />
        </div>
      </div>
      <span>Username</span>
      <input type="text" defaultValue={user.username} />
      <span>Names</span>
      <input type="text" defaultValue={user.name} />
      <span>Email</span>
      <input type="text" defaultValue={user.email} />
      <span>City</span>
      <input type="text" defaultValue={user.city || ""} />
    </div>
  );
};

export default UpdateProfile;
