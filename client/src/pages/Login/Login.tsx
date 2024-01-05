import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import { Login, User } from "../../types";
import { AxiosError, AxiosResponse } from "axios";
import "./login.scss";

const LoginForm = () => {
  const navigate = useNavigate();
  const [errors, setErrors] = useState({ email: "", password: "" });
  const context = useContext(AuthContext);
  const [loginForm, setLoginForm] = useState<Login>({
    email: "",
    password: "",
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleFormSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    context?.ctxLogin(loginForm).then((res) => {
      const error = res as AxiosError<Login>;

      if (res.status === 200) navigate("/");
      if (error.response) {
        setErrors(error.response.data);
      }
    });
  };

  return (
    <div className="login">
      <div className="login-wrapper">
        <div className="left">
          <h1>The Mesh</h1>
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
            <div className="input-container">
              <input
                className={`input ${errors.email && "error"}`}
                type="email"
                name="email"
                placeholder="example@site.com"
                autoComplete="off"
                onChange={handleFormChange}
              />
              <span className="error-msg">{errors.email}</span>
            </div>
            <div className="input-container">
              <input
                className={`input ${errors.password && "error"}`}
                type="password"
                name="password"
                placeholder="Password"
                autoComplete="off"
                onChange={handleFormChange}
              />
              <span className="error-msg">{errors.password}</span>
            </div>
            <button onClick={handleFormSubmit}>Login</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
