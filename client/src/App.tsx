import React, { useContext } from "react";
import { ThemeContext } from "./context/themeContext";
import RouterComponent from "./router/Router";
import "./App.scss";

function App() {
  const context = useContext(ThemeContext);

  return (
    <div className={`theme-${context?.theme}`}>
      <div className="app">
        <RouterComponent />
      </div>
    </div>
  );
}

export default App;
