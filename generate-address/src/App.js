import React from 'react';
import { Container, Row, Col, ListGroup, Badge, Form, InputGroup, Button, Alert, Spinner, Accordion } from 'react-bootstrap';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.scss';

const socket = io("localhost:3001");

const log = console.log;
const logError = console.error;

class App extends React.Component {
  state = {
    isConnected: false, RUN: false, count: 0,
    lastPong: "none",
    DAILY_TIME_RUN: "0:0:0",
    INFURA_API_KEYS: [], current_INFURA_API_KEYS_index: 0,
    address: "0x", privateKey: "privateKey", chain: "chain", error: "error",
    goodWallets: [{ address: "0x", privateKey: "privateKey", chain: "chain" }]
  }

  componentDidMount() {
    socket.onAny((event, ...args) => {
      let name = event[0];
      let msg = event[1];
      if (name === 'count_query') {
        if (msg.error) {
          this.setState({ error: msg.error, RUN: msg.RUN })
        } else
          this.setState({
            count: msg.count,
            address: msg.address,
            privateKey: msg.privateKey,
            current_INFURA_API_KEYS_index: msg.current_INFURA_API_KEYS_index,
            chain: msg.chain,
            RUN: msg.RUN,
          });
      }
      log(msg);
    });

    socket.on("count_query", msg => {
      this.setState({
        RUN: msg.RUN,
      });
    })

    socket.on('connect', () => {
      this.setState({ isConnected: true });
      // socket.emit("INFURA_API_KEYS", { message: "get_INFURA_API_KEYS" })
      log("connected")
      socket.emit("DAILY_TIME_RUN", { command: "get" })
      socket.emit("INFURA_API_KEYS", { command: "get" })
      socket.emit("goodWallets", { command: "get" })
    })

    socket.on("DAILY_TIME_RUN", msg => {
      this.setState({ DAILY_TIME_RUN: msg.DAILY_TIME_RUN })
    })

    socket.on("INFURA_API_KEYS", (msg) => {
      if (msg.error) {
        toast.error(msg.error);
      } else if (msg.message) {
        toast.success(msg.message);
      } else if (msg.INFURA_API_KEYS) {
        this.setState({ INFURA_API_KEYS: msg.INFURA_API_KEYS });
      }
    })

    socket.on("goodWallets", (msg) => {
      this.setState({ goodWallets: msg.goodWallets })
    })

    socket.on('disconnect', () => {
      log("disconnected")
      this.setState({ isConnected: false })
    })
  }

  onChangeDAILY_TIME_RUN(e) {
    // console.log(e.target.value)
    this.setState({ DAILY_TIME_RUN: e.target.value })
  }

  setDAILY_TIME_RUN(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log(this.state.DAILY_TIME_RUN)
    socket.emit('DAILY_TIME_RUN', { command: 'set', DAILY_TIME_RUN: this.state.DAILY_TIME_RUN })
  }

  run() {
    if (!this.state.RUN)
      socket.emit('count_query', "run_now");
    else
      socket.emit('count_query', "pause_now")
  }
  render() {
    const { DAILY_TIME_RUN, RUN, isConnected, INFURA_API_KEYS, current_INFURA_API_KEYS_index, error, privateKey, address, chain } = this.state;
    let variant = isConnected ? 'success' : 'danger';
    return (
      <Container>
        <Row>
          <Form onSubmit={this.setDAILY_TIME_RUN.bind(this)}>
            <Form.Group className="mb-3">
              <Form.Label>
                <Spinner key={variant} variant={variant} className={"full-withradius" + (isConnected ? " border-green" : " border-red")} style={styles.isConnected}>{isConnected ? 'connected' : 'disconnected'}</Spinner >
                Start Time (0:0:0)</Form.Label>
              <InputGroup>
                <Form.Control placeholder="0:0:0" value={DAILY_TIME_RUN} onChange={this.onChangeDAILY_TIME_RUN.bind(this)} />
                <Button variant="outline-secondary" onClick={this.setDAILY_TIME_RUN.bind(this)}>set</Button>
                <Button variant="outline-secondary" onClick={this.run.bind(this)}>{RUN ? "PAUSE" : "RUN"}</Button>
              </InputGroup>
            </Form.Group>
          </Form>

          <Accordion defaultActiveKey="1">

            <Accordion.Item eventKey="0">
              <Accordion.Header><Badge>{INFURA_API_KEYS.length} API KEYS  </Badge>&nbsp;&nbsp;{INFURA_API_KEYS[current_INFURA_API_KEYS_index]}&nbsp; <Badge>{current_INFURA_API_KEYS_index}</Badge></Accordion.Header>
              <Accordion.Body>
                <ListGroup as="ol">
                  {INFURA_API_KEYS.map((v, i) =>
                  (<ListGroup.Item as="li" className="d-flex justify-content-between align-items-start" key={i}>
                    {i} <div className="ms-2 me-auto">
                      {/* <div className={current_INFURA_API_KEYS_index === i ? "fw-bold" : ""}>{v}</div> */}
                      {current_INFURA_API_KEYS_index === i ? (<Badge bg="primary" pill>{v}</Badge>) : <div>{v}</div>}
                    </div>
                  </ListGroup.Item>)
                  )}
                </ListGroup>
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="1">
              <Accordion.Header>Scaning: {chain}</Accordion.Header>
              <Accordion.Body>
                {address}<br />{privateKey}
                <Alert key={"danger"} variant={"danger"}>
                  {error}
                </Alert>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

        </Row>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        {/* Same as */}
        <ToastContainer />
      </Container>
    );
  }
}
const styles = {
  isConnected: {
    textAlign: "center"
  }
}
export default App;
