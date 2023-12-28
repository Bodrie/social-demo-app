import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { AddCircleOutline } from "@mui/icons-material";
import { User } from "../../types";
import { updateUser, upload } from "../../services/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import "./updateProfile.scss";

interface UpaderProfile {
  user: User;
  setUpdateProfile: (visibility: boolean) => void;
}

const UpdateProfile = ({ user, setUpdateProfile }: UpaderProfile) => {
  const queryClient = useQueryClient();
  const authCtx = useContext(AuthContext);
  const [inputValues, setInputValues] = useState<User>({ ...user });
  const [files, setFiles] = useState<Record<string, File | null>>({
    cover: null,
    profile: null,
  });

  const mutation = useMutation({
    mutationFn: (userData: User) => {
      return updateUser(userData);
      // TO DO: Add activity for updated profile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // TO DO: Inavalidate activities
    },
  });

  const handleSaveChanges = async () => {
    let profileImgUrl = inputValues.profile_picture;
    let coverImgUrl = inputValues.cover_picture;

    if (files.profile) {
      profileImgUrl = await upload(files.profile);
      profileImgUrl = `${process.env.REACT_APP_API}/upload/${profileImgUrl}`;
    }

    if (files.cover) {
      coverImgUrl = await upload(files.cover);
      coverImgUrl = `${process.env.REACT_APP_API}/upload/${coverImgUrl}`;
    }

    mutation.mutate(
      {
        ...inputValues,
        profile_picture: profileImgUrl,
        cover_picture: coverImgUrl,
      },
      {
        onSuccess: () => {
          authCtx.setCurrentUser({
            ...inputValues,
            profile_picture: profileImgUrl,
            cover_picture: coverImgUrl,
          });
          setFiles({
            cover: null,
            profile: null,
          });
          setUpdateProfile(false);
          window.location.reload();
        },
      }
    );
    // TO DO: General pop up for confirmation or something like that...;
  };

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
