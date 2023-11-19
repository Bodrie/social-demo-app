import React from "react";
import { Link } from "react-router-dom";
import { DarkModeOutlined, SearchOutlined, MailOutlined, NotificationsOutlined } from "@mui/icons-material";
import "./header.scss";

const Header = () => {
  return (
    <header className="header">
      <div className="left">
        <Link to={"/"}>
          <span>The Network</span>
        </Link>
        <DarkModeOutlined />
        <div className="search">
          <SearchOutlined />
          <input type="text" placeholder="Search..." />
        </div>
      </div>
      <div className="right">
        <NotificationsOutlined />
        <MailOutlined />
        <div className="user">
          <img src="" alt="" />
          <span>User Name</span>
        </div>
      </div>
    </header>
  );
};

export default Header;