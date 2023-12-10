import React from "react";
import { Outlet } from "react-router-dom";
import { Header, LeftBar, RightBar } from "../../components";
import "./main.scss";

const Main = () => {
  return (
    <>
      <Header />
      <div className="main">
        <LeftBar />
        <div className="outlet">
          <Outlet />
        </div>
        <RightBar />
      </div>
    </>
  );
};

export default Main;
