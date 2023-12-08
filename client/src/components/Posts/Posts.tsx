import React, { useContext } from "react";
import { AuthContext } from "../../context/authContext";
import { SinglePost } from "../../components";
import { useQuery } from "@tanstack/react-query";
import { getPosts } from "../../services/axios";
import { Post } from "../../types";
import "./posts.scss";

const Posts = () => {
  const authCtx = useContext(AuthContext);
  const { isLoading, error, data } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: () => getPosts(authCtx?.user?.id as number),
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
