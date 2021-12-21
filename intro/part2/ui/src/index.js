import { ThemeProvider } from "@emotion/react";
import { createTheme, CssBaseline, responsiveFontSizes } from "@mui/material";

import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { EthereumProviderProvider } from "./EthereumProviderContext";
import { SnackbarProvider } from 'notistack';

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
      <SnackbarProvider maxSnack={3}>
        <EthereumProviderProvider>
          <App />
        </EthereumProviderProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
