import React, { useContext, useState } from "react";
import { AddAPhoto, PersonPin } from "@mui/icons-material";
import { AuthContext } from "../../context/authContext";
import { addPost } from "../../services/axios";
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
      setContent('');
      setFile(null);
    },
  });

  const handlePostShare = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    mutation.mutate({ content });
  };

  return (
    <div className="add-post">
      <div className="content">
        <img src={context?.user?.profile_picture} alt="" />
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
        <AddAPhoto />
        <span>Add photo</span>
        <input
          type="file"
          id="file"
          onChange={(e) =>
            setFile(e.currentTarget.files ? e.currentTarget.files[0] : null)
          }
        />
        <PersonPin />
        <span>Tag people</span>
        <button onClick={handlePostShare}>Share</button>
      </div>
    </div>
  );
};

export default AddPost;
