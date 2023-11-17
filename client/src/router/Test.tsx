import React, { useContext } from "react";
import { AuthContext } from "../context/authContext";

const Test = () => {
  const context = useContext(AuthContext);
  const handleLogin = async () => {
    try {
      await context?.login({
        email: "kirov0407@gmail.com",
        password: "1234qwer",
      });
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <>
      <button onClick={handleLogin}>login</button>
      <div>login page</div>
    </>
  );
};

export default Test;
