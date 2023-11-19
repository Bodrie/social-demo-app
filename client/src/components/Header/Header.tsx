import React, { useContext } from "react";
import { ThemeContext } from "../../context/themeContext";
import { Link } from "react-router-dom";
import {
  DarkModeOutlined,
  SearchOutlined,
  MailOutlined,
  NotificationsOutlined,
  WbSunnyOutlined,
} from "@mui/icons-material";
import srcImg from "../../assets/images.png";
import "./header.scss";

const Header = () => {
  const context = useContext(ThemeContext);

  const handleThemeChange = (theme: string) => {
    context?.switchTheme(theme);
  };

  return (
    <header className="header">
      <div className="left">
        <Link to={"/"}>
          <span>The Network</span>
        </Link>
        {context?.theme === "light" ? (
          <DarkModeOutlined onClick={() => handleThemeChange("dark")} />
        ) : (
          <WbSunnyOutlined onClick={() => handleThemeChange("light")} />
        )}
      </div>
      <div className="center">
        <div className="search">
          <SearchOutlined />
          <input type="text" placeholder="Search..." />
        </div>
      </div>
      <div className="right">
        <NotificationsOutlined />
        <MailOutlined />
        <div className="user">
          <img src={srcImg} alt="" />
          <span>User Name</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
