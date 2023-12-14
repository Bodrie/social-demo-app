import React, { useContext, useEffect } from "react";
import { ThemeContext } from "./context/themeContext";
import { AuthContext } from "./context/authContext";
import RouterComponent from "./router/Router";
import { momentConfig } from "./config";
import { socket } from "./socket";
import "./App.scss";

function App() {
  const context = useContext(ThemeContext);
  const authCtx = useContext(AuthContext);
  momentConfig();

  useEffect(() => {
    if (authCtx?.user) {
      socket.emit("user_connection", authCtx?.user);
    }
  }, [socket, authCtx?.user]);

  return (
    <div className={`theme-${context?.theme}`}>
      <div className="app">
        <div className="wrapper">
          <RouterComponent />
        </div>
      </div>
    </div>
  );
}

export default App;
