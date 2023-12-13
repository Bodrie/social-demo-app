import React, { useContext } from "react";
import { ThemeContext } from "./context/themeContext";
import RouterComponent from "./router/Router";
import { momentConfig } from "./config";
import "./App.scss";

function App() {
  const context = useContext(ThemeContext);
  momentConfig();

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
