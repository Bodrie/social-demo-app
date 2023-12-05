import React from "react";
import { SinglePost } from "../../components";
import { useQuery } from "@tanstack/react-query";
import { getPosts } from "../../services/axios";
import { Post } from "../../types";
import "./posts.scss";

const Posts = () => {
  const { isLoading, error, data } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: getPosts,
  });

  return (
    <div className="posts">
      {isLoading
        ? "Loading..."
        : data?.map((post) => {
            return <SinglePost {...post} key={post.id} />;
          })}
    </div>
  );
};

export default Posts;
