import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/nunito";
import "./index.css";
import { applyAccent, savedAccent } from "./theme";

applyAccent(savedAccent());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
