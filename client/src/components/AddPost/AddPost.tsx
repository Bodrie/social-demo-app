import React, { useContext, useState } from "react";
import {
  AddAPhoto,
  PersonPin,
  SentimentSatisfiedAlt,
} from "@mui/icons-material";
import { AuthContext } from "../../context/authContext";
import { addPost, upload, addActivity } from "../../services/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PostCreate } from "../../types/post";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import "./addPost.scss";
import { ThemeContext } from "../../context/themeContext";

const AddPost = () => {
  const queryClient = useQueryClient();
  const authCtx = useContext(AuthContext);
  const themeCtx = useContext(ThemeContext);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fit, setFit] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState(false);

  const mutation = useMutation({
    mutationFn: (newPost: PostCreate) => {
      return (
        addPost(newPost),
        addActivity({
          profilePic: authCtx?.user?.profile_picture!,
          user: authCtx?.user?.name!,
          activity: "created a post.",
          userId: authCtx?.user?.id,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
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

  const handleEmojiSelected = (emoji: EmojiClickData) => {
    setEmojiPicker(false);
    setContent((prevText) => prevText.concat(emoji.emoji));
  };

  return (
    <div className="add-post">
      <div className="content">
        <img
          className="user-profile"
          src={authCtx?.user?.profile_picture}
          alt="Current user"
        />
        <textarea
          name="post"
          id="post"
          cols={30}
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        {content.length ? (
          <span className="char-left">
            Symbols left: {500 - content.length}
          </span>
        ) : (
          ""
        )}
      </div>
      {file && (
        <img
          className={`post-img ${fit ? "contain" : "cover"}`}
          src={URL.createObjectURL(file)}
          alt="Post content"
          onClick={() => setFit(!fit)}
        />
      )}
      <hr />
      <div className="add">
        <input
          type="file"
          id="file"
          onChange={(e) =>
            setFile(e.currentTarget.files ? e.currentTarget.files[0] : null)
          }
        />
        <label htmlFor="file" className="interactions">
          <AddAPhoto />
          <span>Add photo</span>
        </label>
        <PersonPin />
        <span>Tag people</span>
        <div
          className="interactions"
          onClick={() => setEmojiPicker(!emojiPicker)}
        >
          <SentimentSatisfiedAlt className="emoji-picker-icon" />

          <div
            className={`custom-emoji-picker ${emojiPicker ? "visible" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              key={themeCtx?.theme}
              lazyLoadEmojis={true}
              onEmojiClick={handleEmojiSelected}
              previewConfig={{ showPreview: false }}
              searchDisabled={true}
              theme={themeCtx?.theme === "dark" ? Theme.DARK : Theme.LIGHT}
            />
          </div>
        </div>
        <button className="share" onClick={handlePostShare}>
          Share
        </button>
      </div>
    </div>
  );
};

export default AddPost;
