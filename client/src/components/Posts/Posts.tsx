import React from "react";
import { SinglePost } from "../../components";
import { posts } from "../../mocks";
import "./posts.scss";

const Posts = () => {
  return (
    <div className="posts">
      {posts.map((post) => {
        return <SinglePost {...post} key={post.id} />;
      })}
    </div>
  );
};

export default Posts;
