import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Register } from "../../types";
import { register } from "../../services/axios";
import { AxiosError, AxiosResponse } from "axios";
import "./register.scss";

const RegisterForm = () => {
  const navigate = useNavigate();

  const [errors, setErrors] = useState<Register>({
    username: "",
    name: "",
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState<Register>({
    username: "",
    name: "",
    email: "",
    password: "",
  });

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleFormSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    register(e, registerForm).then((res) => {
      const data = res as AxiosResponse<string>;
      const error = res as AxiosError<Register>;
      if (data.status === 200) {
        navigate("/login");
      } else if (error.response) {
        const newErrorData = error.response.data;
        setErrors(newErrorData);
      }
    });
  };

  return (
    <div className="register">
      <div className="register-wrapper">
        <div className="left">
          <h1>Register</h1>
          <form>
            <div className="input-container">
              <input
                className={`input ${errors.username && "error"}`}
                type="text"
                name="username"
                placeholder="Name or nickname"
                autoComplete="off"
                onChange={handleFormChange}
              />
              <span className="error-msg">{errors.username}</span>
            </div>
            <div className="input-container">
              <input
                className={`input ${errors.name && "error"}`}
                type="text"
                name="name"
                placeholder="Your real name"
                autoComplete="off"
                onChange={handleFormChange}
              />
              <span className="error-msg">{errors.name}</span>
            </div>
            <div className="input-container">
              <input
                className={`input ${errors.email && "error"}`}
                type="email"
                name="email"
                placeholder="youremail@site.com"
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
            <button onClick={handleFormSubmit}>Register</button>
          </form>
        </div>
        <div className="right">
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

          <button onClick={() => navigate("/login")}>Login</button>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
