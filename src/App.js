import React, { useState, useRef, useEffect } from 'react';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import {
  Container, Card, CardContent, Typography, Stack, Grid,
  Link, Select, MenuItem, Alert, Button, TextField, Switch, FormControlLabel
} from '@mui/material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const BAUD_RATES = [4800, 9600, 14400, 19200, 38400, 57600, 115200, 128000, 230400, 256000, 460800, 512000, 576000, 921600]

export default function App() {

  const [selectedPortInfo, setSelectedPortInfo] = useState(null);
  const [selectedBaudRate, setSelectedBaudRate] = useState("115200");
  const [selectedDataBits, setSelectedDataBits] = useState(8);
  const [selectedFlowControl, setSelectedFlowControl] = useState("none");
  const [selectedParity, setSelectedParity] = useState("none");
  const [selectedStopBits, setSelectedStopBits] = useState(1);
  const [serialPort, setSerialPort] = useState(null);
  const [sendString, setSendString] = useState("");
  const [addCrLf, setAddCrLf] = useState(true);
  const [hexViewerMode, setHexViewerMode] = useState(false);
  const [bytesPerLine, setBytesPerLine] = useState(16);
  const [receivedString, setReceivedString] = useState("");
  const [receivedHexview, setReceivedHexview] = useState("");
  const [alerts, setAlerts] = useState([]);

  const serialReader = useRef(null);
  const serialWriter = useRef(null);

  const receivedBytes = useRef([]);
  const hexLineIndex = useRef(0);    
  const hexLines = useRef(0);     // Number of completed lines
  const hexString = useRef("");       // The hex output (index, numbers, and string) of all completed lines
  const hexStringLine = useRef("");   // The string part of last incomplete line
  const hexNumbersLine = useRef("");  // The numbers part of last incomplete line

  const showAlert = (severity, message) => {
    setAlerts([...alerts, { severity: severity, message: message }]);
  }

  useEffect(() => {
    setTimeout(() => {
      if (alerts.length > 0) {
        setAlerts(alerts.slice(1));
      }
    }, 6000);
  });

  const connectSerial = async () => {
    try {
      const port = await navigator.serial.requestPort(); // Select port and get user consent (needed for .getInfo).

      await port.open({
        baudRate: selectedBaudRate,
        dataBits: selectedDataBits,
        flowControl: selectedFlowControl,
        parity: selectedParity,
        stopBits: selectedStopBits
      });
      port.ondisconnect = event => {
        showAlert('info', 'Serial port is disconnected from the computer.');
        setSerialPort(null);
      }

      const info = await port.getInfo();
      setSelectedPortInfo(info);
      console.log(`port usbProductId 0x${info.usbProductId.toString(16).padStart(4, '0')} and usbVendorId 0x${info.usbVendorId.toString(16).padStart(4, '0')}`); 
      console.log('port.getSignals', await port.getSignals()); // Could be used for future 'advanced' extension
      
      serialWriter.current = port.writable.getWriter();
      serialReader.current = port.readable.getReader();
      setSerialPort(port);
      readSerialLoop();
      showAlert('success', 'Serial port is connected.');
    }
    catch (e) {
      if (e.name === 'InvalidStateError') {
        const err = e.message + ' It is recommended to refresh the page.';
        showAlert('error', err);
      }
      else {
        console.log(e.name);
        showAlert('error', e.message);
      }
    }
  }

  const disconnectSerial = async (errorMessage = '') => {
    await serialReader.current.cancel();
    await serialWriter.current.close();
    await serialPort.close();
    setSerialPort(null);
    showAlert((errorMessage === '') ? 'success' : 'error', `${errorMessage} Serial port is disconnected.`);
  }

  const readSerialLoop = async () => {
    let run = true;
    while (run) {
      try {
        const { value, done } = await serialReader.current.read();
        if (done) {
          break;
        }
        if (value) {
          receivedBytes.current = new Uint8Array([...receivedBytes.current, ...value]);
          const str = new TextDecoder().decode(receivedBytes.current);
          setReceivedString(str);
          processReceivedBytesToHexView(value);
        }
      }
      catch (e) {
        if (e.name !== 'NetworkError') {
          console.log(e.name);
          showAlert('error', e.message);
        }
        //run = false;
      }
    }
  }

  const processReceivedBytesToHexView = (value) => {
    if (!value) {
      resetHexView();
      value = receivedBytes;
    }

    value.forEach(b => {
      const nStr = (b === 0) ? '--' : b.toString(16).padStart(2, '0');
      const sStr = (b < 32 || b > 126) ? '.' : String.fromCharCode(b);
      if (hexLineIndex.current === bytesPerLine - 1) {
        hexString.current = hexString.current + hexLines.current.toString(10).padStart(6, '0') + '    ' +
          hexNumbersLine.current + ' ' + nStr + '     ' + hexStringLine.current + sStr + '\r\n';
        hexLineIndex.current = 0;
        hexLines.current += bytesPerLine;
        hexNumbersLine.current = "";
        hexStringLine.current = "";
      }
      else {
        hexNumbersLine.current += ' ' + nStr;
        hexStringLine.current += sStr;
        hexLineIndex.current++;
      }
    });

    const line = 
        hexString.current + hexLines.current.toString(10).padStart(6, '0') + '    ' +
        hexNumbersLine.current + '   '.repeat(bytesPerLine - hexLineIndex.current) + '     ' + hexStringLine.current;

    setReceivedHexview(line);
  }

  const resetHexView = () => {
    hexLineIndex.current = 0;
    hexLines.current = 0;
    hexString.current = "";
    hexStringLine.current = "";
    hexNumbersLine.current = "";
  }

  const writeSerial = async (data) => {
    // replace single escape characters
    let s = data.replaceAll('\\n', '\n').replaceAll('\\r', '\r').replaceAll('\\t', '\t').replaceAll('\\f', '\f').replaceAll('\\b', '\b');
    // replace hexadecimal escape characters
    s = s.replaceAll(/\\x[a-fA-F0-9]{2}/g, (v) => {
      return String.fromCharCode(parseInt(v.substr(2), 16));;
    });
    const dataArrayBuffer = new TextEncoder().encode(s);
    return await serialWriter.current.write(dataArrayBuffer);
  }

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
                {alerts.map(({ severity, message }, index) => (
                  <Alert key={index} severity={severity}>{message}</Alert>
                )
                )}
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems='center'>

                      <Typography variant="body1" component="div" sx={{ width: '7%' }}>
                        Baud rate
                      </Typography>
                      <Select disabled={serialPort != null} value={selectedBaudRate} sx={{ width: '10%' }} size='small'
                        onChange={(event) => {
                          setSelectedBaudRate(event.target.value);
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
                      <Select disabled={serialPort != null} value={selectedDataBits} sx={{ width: '5%' }} size='small'
                        onChange={(event) => {
                          setSelectedDataBits(event.target.value);
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
                      <Select disabled={serialPort != null} value={selectedFlowControl} sx={{ width: '11%' }} size='small'
                        onChange={(event) => {
                          setSelectedFlowControl(event.target.value);
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
                      <Select disabled={serialPort != null} value={selectedParity} sx={{ width: '10%' }} size='small'
                        onChange={(event) => {
                          setSelectedParity(event.target.value);
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

                      <Select disabled={serialPort != null} value={selectedStopBits} sx={{ width: '5%' }} size='small'
                        onChange={(event) => {
                          setSelectedStopBits(event.target.value);
                        }}>
                        {[1, 2].map((stopbits, index) => (
                          <MenuItem key={index} value={stopbits}>
                            {stopbits}
                          </MenuItem>
                        ))}
                      </Select>

                      <Button variant="contained" disabled={selectedBaudRate === ""} sx={{ width: '13%' }} onClick={
                        () => {
                          if (serialPort) {
                            disconnectSerial()
                          }
                          else {
                            connectSerial(selectedBaudRate)
                          }
                        }
                      }>
                        {serialPort ? 'Disconnect' : 'Connect'}
                      </Button>

                    </Stack>
                  </CardContent>
                </Card>

                {serialPort      &&
                <Card>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems='center'>

                      <Typography variant="body1" component="div" sx={{ width: '15%' }}>
                        Selected port:
                      </Typography>
                      <Typography variant="body1" component="div" sx={{ width: '20%' }}>
                        usbVendorId 0x{selectedPortInfo && selectedPortInfo.usbVendorId.toString(16).padStart(4, '0')}
                      </Typography>
                      <Typography variant="body1" component="div" sx={{ width: '20%' }}>
                      usbProductId 0x{selectedPortInfo && selectedPortInfo.usbProductId.toString(16).padStart(4, '0')}
                      </Typography>

                    </Stack>
                  </CardContent>
                </Card>
}

                <Card>
                  <CardContent>
                    <Grid container spacing={2}>

                      <Grid item xs={10}>
                        <TextField
                          disabled={serialPort === null} variant='standard' label={'Send to port'} size='small' sx={{ width: '100%' }}
                          value={sendString}
                          helperText='Use of single escape characters (\r \n \t \b \f) and hexadecimal escape characters (\x00 .. \xFF) are allowed'
                          multiline
                          maxRows={5}
                          onChange={(event) => {
                            setSendString(event.target.value);
                          }}
                        />
                      </Grid>

                      <Grid item xs={2}>
                        <Stack alignItems={'bottom'}>

                          <FormControlLabel disabled={serialPort == null} control={
                            <Switch
                              checked={addCrLf}
                              onChange={() => setAddCrLf(!addCrLf)} />
                          } label="add CRLF" >
                          </FormControlLabel>

                          <Button disabled={sendString === ''} variant='contained' sx={{ width: '80%' }}
                            onClick={() => {
                              const crlf = addCrLf ? '\r\n' : '';
                              writeSerial(sendString + crlf);
                              setSendString('');
                            }}
                          >Send</Button>

                        </Stack>
                      </Grid>

                    </Grid>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Stack spacing={2}>

                      <Grid container spacing={2} alignItems='center'>

                        <Grid item xs={5}>
                          Text received
                        </Grid>

                        <Grid item xs={5}>
                          <Stack direction={'row'} spacing={2} alignItems='center'>

                            <FormControlLabel
                              disabled={serialPort == null}
                              control={<Switch
                                checked={hexViewerMode}
                                onChange={() => setHexViewerMode(!hexViewerMode)} />
                              }
                              label="HEX viewer"
                              style={{ width: '35%' }}
                            />

                            <Typography variant="body1" component="div" align='right' sx={{ width: '25%' }}>
                              Bytes per line
                            </Typography>

                            <Select disabled={serialPort == null} value={bytesPerLine} sx={{ width: '15%' }} size='small'
                              onChange={(event) => {
                                setBytesPerLine(event.target.value);
                                processReceivedBytesToHexView(null, event.target.value);
                              }}>
                              {[8, 10, 16].map((bytesPerLine, index) => (
                                <MenuItem key={index} value={bytesPerLine}>
                                  {bytesPerLine}
                                </MenuItem>
                              ))}
                            </Select>

                          </Stack>
                        </Grid>

                        <Grid item xs={2}>
                          <Button disabled={serialPort == null} variant='contained' sx={{ width: '80%' }}
                            onClick={() => {
                              receivedBytes.current =[];
                              setReceivedString("");
                              setReceivedHexview("");
                              resetHexView();
                            }}>Clear</Button>
                        </Grid>

                      </Grid>


                      <pre >
                        {hexViewerMode ? receivedHexview : receivedString}
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
