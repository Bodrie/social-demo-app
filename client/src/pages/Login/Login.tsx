import React from "react";
import { useNavigate } from "react-router-dom";
import "./login.scss";

const Login = () => {
  const navigate = useNavigate();

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
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="off"
            />
            <button>Login</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
