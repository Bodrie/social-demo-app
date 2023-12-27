import React, { useState } from "react";
import { AddCircleOutline } from "@mui/icons-material";
import "./updateProfile.scss";
import { User } from "../../types";

interface UpaderProfile {
  user: User;
  setUpdateProfile: (visibility: boolean) => void;
}

const UpdateProfile = ({ user, setUpdateProfile }: UpaderProfile) => {
  const [inputValues, setInputValues] = useState<User>({ ...user });
  const [files, setFiles] = useState<Record<string, File | null>>({
    cover: null,
    profile: null,
  });

  const handleSaveChanges = () => {};

  const handleDiscardChanges = () => {
    setFiles({ cover: null, profile: null });
    setUpdateProfile(false);
  };

  return (
    <div className="update-profile">
      <div className="profile-pictures">
        <div className="item">
          <img
            src={
              files?.profile
                ? URL.createObjectURL(files.profile)
                : inputValues.profile_picture
            }
            alt="profile pic"
          />
          <label htmlFor="changeProfilePic">
            <AddCircleOutline />
            <span className="field-name">Change</span>
          </label>
          <input
            id="changeProfilePic"
            type="file"
            onChange={(e) => {
              const fileList = e.currentTarget.files;
              if (fileList) {
                setFiles((prev) => ({
                  ...prev,
                  profile: fileList[0],
                }));
              }
            }}
          />
        </div>
        <div className="item">
          <img
            src={
              files?.cover
                ? URL.createObjectURL(files.cover)
                : inputValues.cover_picture
            }
            alt="cover pic"
          />
          <label htmlFor="changeCoverPic">
            <AddCircleOutline />
            <span className="field-name">Change</span>
          </label>
          <input
            id="changeCoverPic"
            type="file"
            onChange={(e) => {
              const fileList = e.currentTarget.files;
              if (fileList) {
                setFiles((prev) => ({
                  ...prev,
                  cover: fileList[0],
                }));
              }
            }}
          />
        </div>
      </div>
      <span className="field-name">Username</span>
      <input
        className="input-field"
        type="text"
        value={inputValues.username}
        onChange={(e) =>
          setInputValues((prev) => ({
            ...prev,
            username: e.target.value,
          }))
        }
      />
      <span className="field-name">Names</span>
      <input
        className="input-field"
        type="text"
        value={inputValues.name}
        onChange={(e) =>
          setInputValues((prev) => ({ ...prev, name: e.target.value }))
        }
      />
      <span className="field-name">Email</span>
      <input
        className="input-field"
        type="text"
        value={inputValues.email}
        onChange={(e) =>
          setInputValues((prev) => ({ ...prev, email: e.target.value }))
        }
      />
      <span className="field-name">City</span>
      <input
        className="input-field"
        type="text"
        value={inputValues.city || ""}
        onChange={(e) =>
          setInputValues((prev) => ({ ...prev, city: e.target.value }))
        }
      />
      <div className="actions">
        <button className="save" onClick={handleSaveChanges}>
          Save changes
        </button>
        <button className="discard" onClick={handleDiscardChanges}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default UpdateProfile;
