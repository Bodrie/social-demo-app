import React, { useContext, useState } from "react";
import { AddAPhoto, PersonPin } from "@mui/icons-material";
import { AuthContext } from "../../context/authContext";
import { addPost, upload } from "../../services/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PostCreate } from "../../types/post";
import "./addPost.scss";

const AddPost = () => {
  const queryClient = useQueryClient();
  const context = useContext(AuthContext);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (newPost: PostCreate) => {
      return addPost(newPost);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setContent("");
      setFile(null);
    },
  });

  const handlePostShare = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    let imgUrl = "";
    if (file) imgUrl = await upload(file);
    mutation.mutate({ content, contentImg: imgUrl });
  };

  return (
    <div className="add-post">
      <div className="content">
        <img src={context?.user?.profile_picture} alt="Current user" />
        <textarea
          name="post"
          id="post"
          cols={30}
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <hr />
      <div className="add">
        <input
          type="file"
          id="file"
          onChange={(e) =>
            setFile(e.currentTarget.files ? e.currentTarget.files[0] : null)
          }
        />
        <label htmlFor="file">
          <AddAPhoto />
          <span>Add photo</span>
        </label>
        <PersonPin />
        <span>Tag people</span>
        <button onClick={handlePostShare}>Share</button>
      </div>
    </div>
  );
};

export default AddPost;
