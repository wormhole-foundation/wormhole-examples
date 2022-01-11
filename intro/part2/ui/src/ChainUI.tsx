import React from "react";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  TextField,
} from "@mui/material";

export function ChainUI(
  name: string,
  messageText: string,
  handleChange: (event: any) => void,
  sendClickHandler: () => void,
  signerAddress: string | undefined,
  processClickHandler: () => void,
  appMsgIdx: number,
  resultText: string
) {
  return (
    <Card sx={{ m: 2 }}>
      <CardHeader title={name} />
      <CardContent>
        <TextField
          multiline
          fullWidth
          rows="3"
          placeholder="Type a message"
          value={messageText}
          onChange={handleChange}
        />
      </CardContent>
      <CardActions>
        <Button
          sx={{ mr: 2 }}
          onClick={sendClickHandler}
          variant="contained"
          disabled={!signerAddress}
        >
          Send
        </Button>
        <Button
          onClick={processClickHandler}
          variant="contained"
          disabled={appMsgIdx < 0 || !signerAddress}
        >
          Process
        </Button>
        <br />
        <TextField
          sx={{ ml: 5, mr: 5, color: "black" }}
          inputProps={{ readOnly: true }}
          fullWidth
          id="process-result"
          label="last process result"
          variant="standard"
          value={resultText}
        ></TextField>
      </CardActions>
    </Card>
  );
}
