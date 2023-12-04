import React from "react";
import { Stories, Posts } from "../../components";
import './home.scss'

const Home = () => {
  return (
    <div className="home">
      <Stories />
      <Posts />
    </div>
  );
};

export default Home;
