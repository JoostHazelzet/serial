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
const HEX_CHARACTERS_PER_LINE = 10;

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
      sendString: "",
      addCrLf: true,
      hexViewerMode: false,
      receivedString: "",
      receivedHexview: "",
      receivedBytes: [],
      alert: { severity: '', message: '' },
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

  async componentDidMount() {
    if ("serial" in navigator) {
      //const p = await navigator.serial.getPorts();
      //console.log('ports', p);
    }
  }

  showAlert(severity, message) {
    //this.setState({alert: {severity: severity, message: message}});
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
      port.onconnect = event => {
        this.showAlert('info', 'Serial port is connected to the computer.');
      }
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
          console.log(value);
          value.forEach(b => {
            const nStr = b.toString(16).padStart(2, '0');
            const sStr = (b < 32 || b > 126) ? '.' : String.fromCharCode(b);
            if (this.hexLineIndex === HEX_CHARACTERS_PER_LINE - 1) {
              this.hexString += this.hexLines.toString(10).padStart(4, '0') + '  ' + this.hexNumbersLine + ' ' + nStr + '     ' + this.hexStringLine + sStr + '\r\n';
              this.hexLineIndex = 0;
              this.hexLines += HEX_CHARACTERS_PER_LINE;
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
            receivedString: this.state.receivedString.concat(this.decoder.decode(value)),
            receivedBytes: [...this.state.receivedBytes, ...value],
            receivedHexview: this.hexString + this.hexLines.toString(10).padStart(4, '0') + '  ' + this.hexNumbersLine + '   '.repeat(HEX_CHARACTERS_PER_LINE-this.hexLineIndex) + '     ' + this.hexStringLine
          });
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

  getHexValue(c) {
    if (c >= 48 && c <=57) {
      return c-48;
    }
    else if (c >= 65 && c <=70) {
      return c-55;
    }  
    else if (c >= 97 && c <=102) {
      return c-87;
    }  
    else
    return -1
  }

  async writeSerial(data) {
    let s = data.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t').replace('\\f', '\f').replace('\\b', '\b');

    // Hallo \x02allem\x07aal
    let p = 0;
    while (true) {
      p = s.indexOf('\\', p);
      if (p !== -1) {
        let sub = s.substr(p + 2, 2);
        if (s.substr(p+1,1) === 'x' && /[0-9A-Fa-f]{2}/g.test(sub)) {
          const c = String.fromCharCode(parseInt(sub, 16));
          console.log(p, sub, c);
          s = s.replace('\\x'+sub, c);
        }
        else {
          break;
        }
      }
      p++;
    }

    const dataArrayBuffer = this.encoder.encode(s);
    // for (let i=0; i< dataArrayBuffer.length - 3; i++) {
    //   // \x00..FF
    //   console.log(i, dataArrayBuffer[i], dataArrayBuffer[i+1], dataArrayBuffer[i+2], dataArrayBuffer[i+3]);
    //   if (dataArrayBuffer[i]===92 && dataArrayBuffer[i+1]===120) {  
    //     const hb = this.getHexValue(dataArrayBuffer[i+2]);
    //     const lb = this.getHexValue(dataArrayBuffer[i+3]);
    //     if (hb !== -1 && lb !== -1) {
    //       dataArrayBuffer[i] = (hb << 4) + lb;
    //       dataArrayBuffer.splice(i+1, 3);
    //     }
    //   }
    // }

    return await this.serialWriter.write(dataArrayBuffer);
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
                {this.state.alert.severity !== '' && <Alert severity={this.state.alert.severity}>{this.state.alert.message}</Alert>}
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
                        disabled={this.state.serialPort == null} variant='standard' label={'Send to port'} size='small' sx={{ width: '80%' }}
                        value={this.state.sendString}
                        helperText='Use of escape characters \r \n \t \b \f is allowed and hex escape \x00 .. \xFF'
                        onChange={(event) => {
                          this.setState({ sendString: event.target.value });
                        }}></TextField>

                      <Stack>

                        <FormControlLabel disabled={this.state.serialPort == null} control={
                          <Switch
                            checked={this.state.addCrLf}
                            onChange={() => this.setState({ addCrLf: !this.state.addCrLf })} />
                        } label="add CRLF">
                        </FormControlLabel>

                        <Button disabled={this.state.sendString === ''} variant='contained' 
                          onClick={() => {
                            const crlf = this.state.addCrLf ? '\r\n' : '';
                            this.writeSerial(this.state.sendString + crlf);
                            this.setState({sendString: ''});
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

                        <FormControlLabel disabled={!this.state.serialPort} control={<div style={{width: '1.5%'}}/>}
                          label="Text received" sx={{ width: '65.3%' }} />

                        <FormControlLabel
                          disabled={!this.state.serialPort}
                          control={<Switch
                            checked={this.state.hexViewerMode}
                            onChange={() => this.setState({ hexViewerMode: !this.state.hexViewerMode })} />
                          }
                          label="HEX viewer">
                        </FormControlLabel>

                        <Button disabled={!this.state.serialPort} variant='contained' sx={{ width: '12.3%' }}
                          onClick={() => {
                            this.setState({receivedString: "", receivedHexview: "", receivedBytes: []});
                            this.hexLineIndex = 0;
                            this.hexLines = 0; 
                            this.hexString = ""; 
                            this.hexStringLine = "";  
                            this.hexNumbersLine = ""; 
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
