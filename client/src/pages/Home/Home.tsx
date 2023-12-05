import React from "react";
import { Stories, Posts, AddPost } from "../../components";
import "./home.scss";

const Home = () => {
  return (
    <div className="home">
      <Stories />
      <AddPost />
      <Posts />
    </div>
  );
};

export default Home;
