import React from "react";
import { Outlet } from "react-router-dom";
import { Header, LeftBar, RightBar } from "../../components";

const Main = () => {
  return (
    <>
      <Header />
      <div style={{ display: "flex" }}>
        <LeftBar />
        <div style={{ flex: 6 }}>
          <Outlet />
        </div>
        <RightBar />
      </div>
    </>
  );
};

export default Main;
