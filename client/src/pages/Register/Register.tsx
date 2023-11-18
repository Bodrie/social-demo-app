import React from "react";
import { useNavigate } from "react-router-dom";
import "./register.scss";

const Register = () => {
  const navigate = useNavigate();
  return (
    <div className="register">
      <div className="register-wrapper">
        <div className="left">
          <h1>Register</h1>
          <form>
          <input
              type="text"
              name="name"
              placeholder="Name or nickname"
              autoComplete="off"
            />
            <input
              type="text"
              name="username"
              placeholder="Your real name"
              autoComplete="off"
            />
            <input
              type="email"
              name="email"
              placeholder="youremail@site.com"
              autoComplete="off"
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="off"
            />
            <button>Register</button>
          </form>
        </div>
        <div className="right">
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

          <button onClick={() => navigate("/login")}>Login</button>
        </div>
      </div>
    </div>
  );
};

export default Register;
