import React, { useContext, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
import { Register } from "../../types";
import { register } from "../../services/axios";
import "./register.scss";

const RegisterForm = () => {
  const navigate = useNavigate();
  const context = useContext(AuthContext);
  const [registerForm, setRegisterForm] = useState<Register>({
    username: "",
    name: "",
    email: "",
    password: "",
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    register(e, registerForm).then((res) => {
      if (res.status === 200) {
        context
          ?.login({
            email: registerForm.email,
            password: registerForm.password,
          })
          .then((res) => {
            if (res === "ready") navigate("/profile");
          });
      }
    });
  };

  return (
    <div className="register">
      <div className="register-wrapper">
        <div className="left">
          <h1>Register</h1>
          <form>
            <input
              type="text"
              name="username"
              placeholder="Name or nickname"
              autoComplete="off"
              onChange={handleFormChange}
            />
            <input
              type="text"
              name="name"
              placeholder="Your real name"
              autoComplete="off"
              onChange={handleFormChange}
            />
            <input
              type="email"
              name="email"
              placeholder="youremail@site.com"
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
            <button onClick={handleFormSubmit}>Register</button>
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

export default RegisterForm;
