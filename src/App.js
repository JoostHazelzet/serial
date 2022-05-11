import React from 'react';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import {
  Container, Card, CardContent, Typography, Stack,
  Link, Select, MenuItem, Alert, Button, TextField, Switch, FormControlLabel
} from '@mui/material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const BAUD_RATES = [4800, 9600, 14400, 19200, 38400, 57600, 115200, 128000, 230400, 256000, 460800, 512000, 576000, 921600]

class App extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      ports: [],
      selectedPort: "",
      selectedBaudRate: "",
      selectedDataBits: 8,
      selectedFlowControl: "none",
      selectedParity: "none",
      selectedStopBits: 1,
      SerialPort: null,
      sendString: "\\x46\\x69\\x6E\\x67\\x65\\x72\\x73\\x70\\x69\\x74\\x7A\\x65\\x6E\\x67\\x65\\x66\\xFC\\x68\\x6C\\x20\\x69\\x73\\x20\\x61\\x20\\x47\\x65\\x72\\x6D\\x61\\x6E\\x20\\x74\\x65\\x72\\x6D\\x2E\\n\\x49\\x74\\u2019\\x73\\x20\\x70\\x72\\x6F\\x6E\\x6F\\x75\\x6E\\x63\\x65\\x64\\x20\\x61\\x73\\x20\\x66\\x6F\\x6C\\x6C\\x6F\\x77\\x73\\x3A\\x20\\x5B\\u02C8\\x66\\u026A\\u014B\\u0250\\u02CC\\u0283\\x70\\u026A\\x74\\x73\\u0259\\x6E\\u0261\\u0259\\u02CC\\x66\\x79\\u02D0\\x6C\\x5D",
      addCrLf: true,
      hexViewerMode: false,
      bytesPerLine: 16,
      receivedString: "",
      receivedHexview: "",
      receivedBytes: [],
      alerts: [] //{severity: 'error', message: 'hoi'}, {severity: 'info', message: 'hoi'}
    }

    this.serialReader = null;
    this.serialWriter = null;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();

    this.hexLineIndex = 0;
    this.hexLines = 0;  // Number of completed lines
    this.hexString = ""; // The hex output (index, numbers, and string) of all completed lines
    this.hexStringLine = "";  // The string part of last incomplete line
    this.hexNumbersLine = ""; // The numbers part of last incomplete line

    this.connectSerial = this.connectSerial.bind(this);
    this.disconnectSerial = this.disconnectSerial.bind(this);
    this.writeSerial = this.writeSerial.bind(this);
  }

  showAlert(severity, message) {
    this.setState({ alerts: [...this.state.alerts, { severity: severity, message: message }] });
    setTimeout(() => {
      if (this.state.alerts.length > 0) {
        this.setState({ alerts: this.state.alerts.slice(1) });
      }
    }, 6000);
  }

  async connectSerial(baudRate) {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: this.state.selectedBaudRate,
        dataBits: this.state.selectedDataBits,
        flowControl: this.state.selectedFlowControl,
        parity: this.state.selectedParity,
        stopBits: this.state.selectedStopBits
      });
      port.ondisconnect = event => {
        this.showAlert('info', 'Serial port is disconnected from the computer.');
        this.setState({ serialPort: null });
      }
      console.log('port.getSignals', await port.getSignals());
      this.serialWriter = port.writable.getWriter();
      this.serialReader = port.readable.getReader();
      this.setState({
        serialPort: port,
      });
      this.readSerialLoop();
      this.showAlert('success', 'Serial port is connected.');
    }
    catch (e) {
      if (e.name === 'InvalidStateError') {
        const err = e.message + ' It is recommended to refresh the page.';
        this.showAlert('error', err);
      }
      else {
        console.log(e.name);
        this.showAlert('error', e.message);
      }
    }
  }

  async disconnectSerial(errorMessage = '') {
    await this.serialReader.cancel();
    await this.serialWriter.close();
    await this.state.serialPort.close();
    this.setState({ serialPort: null });
    this.showAlert((errorMessage === '') ? 'success' : 'error', `${errorMessage} Serial port is disconnected.`);
  }

  async readSerialLoop() {
    let run = true;
    while (run) {
      try {
        const { value, done } = await this.serialReader.read();
        if (done) {
          break;
        }
        if (value) {
          this.setState({
            receivedString: this.state.receivedString.concat(this.decoder.decode(value)),
            receivedBytes: [...this.state.receivedBytes, ...value],
          });
         this.processReceivedBytesToHexView(value, this.state.bytesPerLine);
        }
      }
      catch (e) {
        if (e.name !== 'NetworkError') {
          console.log(e.name);
          this.showAlert('error', e.message);
        }
        run = false;
      }
    }
  }

  processReceivedBytesToHexView(value, bytesPerLine) {
    if (!value) {
      this.resetHexView();
      value = this.state.receivedBytes;
    }
    
    value.forEach(b => {
      const nStr = (b === 0) ? '--' : b.toString(16).padStart(2, '0');
      const sStr = (b < 32 || b > 126) ? '.' : String.fromCharCode(b);
      if (this.hexLineIndex === bytesPerLine- 1) {
        this.hexString += this.hexLines.toString(10).padStart(4, '0') + '  ' + this.hexNumbersLine + ' ' + nStr + '     ' + this.hexStringLine + sStr + '\r\n';
        this.hexLineIndex = 0;
        this.hexLines += bytesPerLine;
        this.hexNumbersLine = "";
        this.hexStringLine = "";
      }
      else {
        this.hexNumbersLine += ' ' + nStr;
        this.hexStringLine += sStr;
        this.hexLineIndex++;
      }
    });

    this.setState({
      receivedHexview: this.hexString + this.hexLines.toString(10).padStart(4, '0') + '  ' + this.hexNumbersLine + '   '.repeat(bytesPerLine - this.hexLineIndex) + '     ' + this.hexStringLine
    });
  }

  resetHexView() {
    this.hexLineIndex = 0;
    this.hexLines = 0;
    this.hexString = "";
    this.hexStringLine = "";
    this.hexNumbersLine = "";
  }

  async writeSerial(data) {
    // replace single escape characters
    let s = data.replaceAll('\\n', '\n').replaceAll('\\r', '\r').replaceAll('\\t', '\t').replaceAll('\\f', '\f').replaceAll('\\b', '\b');
    // replace hexadecimal escape characters
    s = s.replaceAll(/\\x[a-fA-F0-9]{2}/g, (v) => {
      return String.fromCharCode(parseInt(v.substr(2), 16));;
    });

    const dataArrayBuffer = this.encoder.encode(s);

    this.setState({
      receivedString: this.state.receivedString.concat(s),
      receivedBytes: [...this.state.receivedBytes, ...dataArrayBuffer],
    });

    this.processReceivedBytesToHexView(dataArrayBuffer, this.state.bytesPerLine);
    //return await this.serialWriter.write(dataArrayBuffer);
  }

  render() {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container fixed>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1" marginTop={5} marginBottom={5} align='center'>
              Serial Port Monitor
            </Typography>


            {("serial" in navigator) ?
              <>
                {this.state.alerts.map(({ severity, message }, index) => (
                  <Alert key={index} severity={severity}>{message}</Alert>
                )
                )}
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems='center'>

                      <Typography variant="body1" component="div" sx={{ width: '7%' }}>
                        Baud rate
                      </Typography>
                      <Select disabled={this.state.serialPort != null} value={this.state.selectedBaudRate} sx={{ width: '10%' }} size='small'
                        onChange={(event) => {
                          this.setState({ selectedBaudRate: event.target.value });
                        }}>
                        {BAUD_RATES.map((baudRate, index) => (
                          <MenuItem key={index} value={baudRate}>
                            {baudRate}
                          </MenuItem>
                        ))}
                      </Select>

                      <Typography variant="body1" component="div" align='right' sx={{ width: '8%' }}>
                        Data bits
                      </Typography>
                      <Select disabled={this.state.serialPort != null} value={this.state.selectedDataBits} sx={{ width: '5%' }} size='small'
                        onChange={(event) => {
                          this.setState({ selectedDataBits: event.target.value });
                        }}>
                        {[7, 8].map((dataBits, index) => (
                          <MenuItem key={index} value={dataBits}>
                            {dataBits}
                          </MenuItem>
                        ))}
                      </Select>

                      <Typography variant="body1" component="div" align='right' sx={{ width: '8%' }}>
                        Flow control
                      </Typography>
                      <Select disabled={this.state.serialPort != null} value={this.state.selectedFlowControl} sx={{ width: '11%' }} size='small'
                        onChange={(event) => {
                          this.setState({ selectedFlowControl: event.target.value });
                        }}>
                        {["none", "hardware"].map((flowControl, index) => (
                          <MenuItem key={index} value={flowControl}>
                            {flowControl}
                          </MenuItem>
                        ))}
                      </Select>

                      <Typography variant="body1" component="div" align='right' sx={{ width: '4%' }}>
                        Parity
                      </Typography>
                      <Select disabled={this.state.serialPort != null} value={this.state.selectedParity} sx={{ width: '10%' }} size='small'
                        onChange={(event) => {
                          this.setState({ selectedParity: event.target.value });
                        }}>
                        {["none", "even", "odd"].map((parity, index) => (
                          <MenuItem key={index} value={parity}>
                            {parity}
                          </MenuItem>
                        ))}
                      </Select>

                      <Typography variant="body1" component="div" align='right' sx={{ width: '6%' }}>
                        Stop bits
                      </Typography>

                      <Select disabled={this.state.serialPort != null} value={this.state.selectedStopBits} sx={{ width: '5%' }} size='small'
                        onChange={(event) => {
                          this.setState({ selectedStopBits: event.target.value });
                        }}>
                        {[1, 2].map((stopbits, index) => (
                          <MenuItem key={index} value={stopbits}>
                            {stopbits}
                          </MenuItem>
                        ))}
                      </Select>

                      <Button variant="contained" disabled={this.state.selectedBaudRate === ""} sx={{ width: '13%' }} onClick={
                        () => {
                          if (this.state.serialPort) {
                            this.disconnectSerial()
                          }
                          else {
                            this.connectSerial(this.state.selectedBaudRate)
                          }
                        }
                      }>
                        {this.state.serialPort ? 'Disconnect' : 'Connect'}
                      </Button>

                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2}>

                      <TextField
                        disabled={this.state.serialPort === null} variant='standard' label={'Send to port'} size='small' sx={{ width: '80%' }}
                        value={this.state.sendString}
                        helperText='Use of single escape characters (\r \n \t \b \f) and hexadecimal escape characters (\x00 .. \xFF) is allowed'
                        multiline
                        maxRows={3}
                        onChange={(event) => {
                          this.setState({ sendString: event.target.value });
                        }}></TextField>

                      <Stack>

                        <FormControlLabel disabled={this.state.serialPort === null} control={
                          <Switch
                            checked={this.state.addCrLf}
                            onChange={() => this.setState({ addCrLf: !this.state.addCrLf })} />
                        } label="add CRLF">
                        </FormControlLabel>

                        <Button disabled={this.state.sendString === ''} variant='contained'
                          onClick={() => {
                            const crlf = this.state.addCrLf ? '\r\n' : '';
                            this.writeSerial(this.state.sendString + crlf);
                            //this.setState({ sendString: '' });
                          }}
                        >Send</Button>

                      </Stack>

                    </Stack>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems='center'>

                        <FormControlLabel disabled={this.state.serialPort} control={<div style={{ width: '1.5%' }} />}
                          label="Text received" sx={{ width: '65.3%' }} />

                        <FormControlLabel
                          disabled={this.state.serialPort}
                          control={<Switch
                            checked={this.state.hexViewerMode}
                            onChange={() => this.setState({ hexViewerMode: !this.state.hexViewerMode })} />
                          }
                          label="HEX viewer">
                        </FormControlLabel>

                      <Typography variant="body1" component="div" align='right' sx={{ width: '8%' }}>
                        Bytes per line
                      </Typography>
                      <Select disabled={this.state.serialPort != null} value={this.state.bytesPerLine} sx={{ width: '5%' }} size='small'
                        onChange={(event) => {
                          this.setState({ bytesPerLine: event.target.value });
                          this.processReceivedBytesToHexView(null, event.target.value);
                        }}>
                        {[8, 10, 16].map((bytesPerLine, index) => (
                          <MenuItem key={index} value={bytesPerLine}>
                            {bytesPerLine}
                          </MenuItem>
                        ))}
                      </Select>

                        <Button disabled={this.state.serialPort != null} variant='contained' sx={{ width: '12.3%' }}
                          onClick={() => {
                            this.setState({ receivedString: "", receivedHexview: "", receivedBytes: [] });
                            this.resetHexView();
                          }}
                        >Clear</Button>

                      </Stack>


                      <pre >
                        {this.state.hexViewerMode ? this.state.receivedHexview : this.state.receivedString}
                      </pre>

                    </Stack>
                  </CardContent>
                </Card>

              </>
              :
              <Alert severity="error">This browser does not support the <Link href={'https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API'}>Web Serial API</Link> yet. Please use a supporting browser like Chrome or Edge</Alert>
            }
          </Stack>
        </Container>
      </ThemeProvider>
    );
  }
}

export default App;
