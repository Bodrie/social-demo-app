import React, { useContext } from "react";
import { AddAPhoto, PersonPin } from "@mui/icons-material";
import "./addPost.scss";
import { AuthContext } from "../../context/authContext";
import defImg from "../../assets/IMG_3301 (2).jpg";

const AddPost = () => {
  const context = useContext(AuthContext);

  return (
    <div className="add-post">
      <div className="content">
        <img src={context?.user?.profile_picture || defImg} alt="" />
        <textarea name="" id="" cols={30} rows={10} />
      </div>
      <hr />
      <div className="add">
        <AddAPhoto />
        <span>Add photo</span>
        <PersonPin />
        <span>Tag people</span>
        <button>Share</button>
      </div>
    </div>
  );
};

export default AddPost;
