import React, { useContext, useEffect } from "react";
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
    queryFn: getPosts,
  });

  useEffect(() => {
    if (error?.message.includes("401")) {
      return authCtx?.ctxLogout();
    }
  }, [error]);

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
