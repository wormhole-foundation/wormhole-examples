import { ThemeProvider } from "@emotion/react";
import { createTheme, CssBaseline, responsiveFontSizes } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { EthereumProviderProvider } from "./contexts/EthereumProviderContext";
import { SolanaWalletProvider } from "./contexts/SolanaWalletContext";
import { TerraWalletProvider } from "./contexts/TerraWalletContext.tsx";
import { SnackbarProvider } from "notistack";

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
        <SolanaWalletProvider>
          <EthereumProviderProvider>
            <TerraWalletProvider>
              <App />
            </TerraWalletProvider>
          </EthereumProviderProvider>
        </SolanaWalletProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
