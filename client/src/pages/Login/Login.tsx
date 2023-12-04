import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import { Login } from "../../types";
import "./login.scss";

const LoginForm = () => {
  const navigate = useNavigate();
  const context = useContext(AuthContext);
  const [loginForm, setLoginForm] = useState<Login>({
    email: "",
    password: "",
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    context?.ctxLogin(loginForm).then((res) => {
      if (res === "ready") navigate("/");
    });
  };

  return (
    <div className="login">
      <div className="login-wrapper">
        <div className="left">
          <h1>The Network</h1>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Libero cum,
            alias totam numquam ipsa exercitationem dignissimos, error nam,
            consequatur.
          </p>
          <p>
            Lorem ipsum dolor. Libero cum, alias totam numquam ipsa
            exercitationem dignissimos, error nam.
          </p>

          <button onClick={() => navigate("/register")}>Register</button>
        </div>
        <div className="right">
          <h1>Login</h1>
          <form>
            <input
              type="email"
              name="email"
              placeholder="example@site.com"
              autoComplete="off"
              onChange={handleFormChange}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="off"
              onChange={handleFormChange}
            />
            <button onClick={handleFormSubmit}>Login</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
