import React, { useContext } from "react";
import { ThemeContext } from "../../context/themeContext";
import { AuthContext } from "../../context/authContext";
import { Link } from "react-router-dom";
import {
  DarkModeOutlined,
  SearchOutlined,
  Logout,
  WbSunnyOutlined,
} from "@mui/icons-material";
import HeaderMobile from "./HeaderMobile";
import "./header.scss";

const Header = () => {
  const themeCtx = useContext(ThemeContext);
  const authCtx = useContext(AuthContext);

  const handleThemeChange = (theme: string) => {
    themeCtx?.switchTheme(theme);
  };

  return (
    <header className="header">
      <div className="left">
        <Link to={"/"}>
          <span>The Mesh</span>
        </Link>
        {themeCtx?.theme === "light" ? (
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
        <Link to={`/profile?id=${authCtx?.user?.id}`}>
          <div className="user">
            <img src={authCtx?.user?.profile_picture} alt="Current user" />
            <span>{authCtx?.user?.name}</span>
          </div>
        </Link>
        <div className="logout" onClick={authCtx?.ctxLogout}>
          <Logout />
          <span>Logout</span>
        </div>
      </div>
      <HeaderMobile />
    </header>
  );
};

export default Header;
