import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import "./headerMobile.scss";
import { AuthContext } from "../../context/authContext";

const HeaderMobile = () => {
  const authCtx = useContext(AuthContext);
  const [menuVisibility, setMenuVisibility] = useState("");

  const handleMenuVisibility = () => {
    setMenuVisibility(menuVisibility === "" ? "visible" : "");
  };

  return (
    <div className="right-mobile">
      <img
        src={authCtx?.user?.profile_picture}
        alt="Current user"
        onClick={handleMenuVisibility}
      />
      <ul className={`menu ${menuVisibility}`}>
        <li onClick={() => setMenuVisibility("")}>
          <Link to={`/profile?id=${authCtx?.user?.id}`}>Profile </Link>
        </li>
        <li onClick={authCtx?.ctxLogout}>Logout</li>
      </ul>
    </div>
  );
};

export default HeaderMobile;
