import { ThemeProvider } from "@emotion/react";
import { createTheme, CssBaseline, responsiveFontSizes } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { EthereumProviderProvider } from "./EthereumProviderContext";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});
const theme = responsiveFontSizes(darkTheme);

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <EthereumProviderProvider>
        <App />
      </EthereumProviderProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
