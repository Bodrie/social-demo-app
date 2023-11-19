import React from "react";
import { Outlet } from "react-router-dom";
import { Header, LeftBar, RightBar } from "../../components";

const Main = () => {
  return (
    <>
      <Header />
      <LeftBar />
      <Outlet />
      <RightBar />
    </>
  );
};

export default Main;
