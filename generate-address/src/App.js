import React from 'react';
import { Container, Row, Col, ListGroup, Badge, Form, InputGroup, Button, Alert, Spinner, Accordion } from 'react-bootstrap';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.scss';

// var socket = io("20.125.138.213:3001");

const log = console.log;
const logError = console.error;

class App extends React.Component {
  state = {
    socket: io("localhost:3001"), host: "localhost:3001", waitSocketConnect: null,
    events: ['connect', "count_query", "DAILY_TIME_RUN", "API_KEYS", "goodWallets", 'disconnect',],
    isConnected: false, RUN: false, count_query: 0,
    lastPong: "none",
    DAILY_TIME_RUN: "0:0:0",
    API_KEYS: [], current_API_KEYS_index: 0,
    address: "0x", privateKey: "privateKey", chain: "chain", error: "!",
    goodWallets: [{ address: "0x", privateKey: "privateKey", chain: "chain", balance: 0 }]
  }

  initEvent(socket) {
    socket.onAny((event, ...args) => {
      // log("initEvent", event)
      let name = event[0];
      let msg = event[1];
      if (name === 'count_query') {
        if (msg.error) {
          this.setState({ error: msg.error, RUN: msg.RUN })
        } else
          this.setState({
            count_query: msg.count_query,
            address: msg.address,
            privateKey: msg.privateKey,
            current_API_KEYS_index: msg.current_API_KEYS_index,
            chain: msg.chain,
            RUN: msg.RUN,
          });
      }
      if (name === 'goodWallets') {
        if (msg.newGoodWallets) {
          toast.success(msg.newGoodWallets.privateKey)
          socket.emit("goodWallets", { command: "get" })
          // this.setState({ goodWallets: [...this.state.goodWallets, msg.goodWallets] })

          // let goodWallets_stored = JSON.parse(localStorage.getItem('goodWallets')) || [];
          // goodWallets_stored.push(msg.newGoodWallets);
          // this.setState({ goodWallets: goodWallets_stored })
        }
      }
    });

    socket.on('connect', () => {
      log(socket.io.uri)
      this.setState({ isConnected: true });
      // socket.emit("API_KEYS", { message: "get_API_KEYS" })
      log("connected")
      socket.emit("DAILY_TIME_RUN", { command: "get" })
      socket.emit("API_KEYS", { command: "get" })
      socket.emit("goodWallets", { command: "get" })
      socket.emit("count_query", { command: "get" })
    })

    socket.on("count_query", msg => {
      this.setState({
        RUN: msg.RUN,
        count_query: msg.count_query,
      });
    })

    socket.on("DAILY_TIME_RUN", msg => {
      if (msg.status === "SUCCESS" && msg.message)
        toast.success(msg.message)
      this.setState({ DAILY_TIME_RUN: msg.DAILY_TIME_RUN })
    })

    socket.on("API_KEYS", (msg) => {
      if (msg.error) {
        toast.error(msg.error);
      } else if (msg.message) {
        toast.success(msg.message);
      } else if (msg.API_KEYS) {
        this.setState({ API_KEYS: msg.API_KEYS });
      }
    })

    socket.on("goodWallets", (msg) => {
      log(msg)
      if (msg.goodWallets) {
        this.setState({ goodWallets: msg.goodWallets })
        localStorage.setItem('goodWallets', JSON.stringify(msg.goodWallets))
      }
    })

    socket.on('disconnect', () => {
      log("disconnected")
      this.setState({ isConnected: false })
    })
  }

  componentDidMount() {
    this.initEvent(this.state.socket)
  }

  onChangeDAILY_TIME_RUN(e) {
    // console.log(e.target.value)
    this.setState({ DAILY_TIME_RUN: e.target.value })
  }

  setDAILY_TIME_RUN(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log(this.state.DAILY_TIME_RUN)
    this.state.socket.emit('DAILY_TIME_RUN', { command: 'set', DAILY_TIME_RUN: this.state.DAILY_TIME_RUN })
  }

  run() {
    if (!this.state.RUN)
      this.state.socket.emit('count_query', "run_now");
    else
      this.state.socket.emit('count_query', "pause_now")
  }
  setNowTimer() {
    let now = new Date();
    let t = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
    this.setState({ DAILY_TIME_RUN: t })
  }
  onChangeHost(e) {
    this.setState({
      host: e.target.value,
    })
  }
  connectHost(e) {
    e.preventDefault();
    e.stopPropagation();

    this.state.socket.disconnect();
    clearInterval(this.state.waitSocketConnect);
    const socket = io(this.state.host)

    this.state.waitSocketConnect = setInterval(() => {
      log(socket)
      if (socket.connected) {
        // this.state.events.map(e => this.state.socket.off(e))
        this.initEvent(socket)
        this.setState({
          "socket": socket, isConnected: true,
        })
        clearInterval(this.state.waitSocketConnect);
      }
    }, 100);

    log('socket', this.state.socket)
  }

  render() {
    const { DAILY_TIME_RUN, RUN, host, isConnected, count_query, API_KEYS, current_API_KEYS_index, error, goodWallets, privateKey, address, chain } = this.state;
    let variant = isConnected ? 'success' : 'danger';
    return (
      <Container>
        <Row>
          <Form onSubmit={this.connectHost.bind(this)}>
            <Form.Label>
              <InputGroup>
                <Button variant="outline-secondary" onClick={this.connectHost.bind(this)}>connect</Button>
                <Form.Control placeholder="localhost:3001" value={host} onChange={this.onChangeHost.bind(this)} />
                <Spinner key={variant} variant={variant} className={"full-withradius" + (isConnected ? " border-green" : " border-red")} style={styles.isConnected}>{isConnected ? 'connected' : 'disconnected'}</Spinner >
              </InputGroup></Form.Label>
          </Form>
          <Form onSubmit={this.setDAILY_TIME_RUN.bind(this)}>
            <Form.Group className="mb-3">
              Start Time (0:0:0)
              <InputGroup>
                <Button variant="outline-secondary" onClick={this.setNowTimer.bind(this)}>now</Button>
                <Form.Control placeholder="0:0:0" value={DAILY_TIME_RUN} onChange={this.onChangeDAILY_TIME_RUN.bind(this)} />
                <Button variant="outline-secondary" onClick={this.setDAILY_TIME_RUN.bind(this)}>set</Button>
                <Button variant="outline-secondary" onClick={this.run.bind(this)}>{RUN ? "PAUSE" : "RUN"}</Button>
              </InputGroup>
            </Form.Group>
          </Form>

          <Accordion defaultActiveKey="1">

            <Accordion.Item eventKey="0">
              <Accordion.Header><Badge>{API_KEYS.length} API KEYS  </Badge>&nbsp;&nbsp;{API_KEYS[current_API_KEYS_index]}&nbsp; <Badge>{current_API_KEYS_index}</Badge></Accordion.Header>
              <Accordion.Body>
                <ListGroup as="ol">
                  {API_KEYS.map((v, i) =>
                  (<ListGroup.Item as="li" className="d-flex justify-content-between align-items-start" key={i}>
                    {i} <div className="ms-2 me-auto">
                      {/* <div className={current_API_KEYS_index === i ? "fw-bold" : ""}>{v}</div> */}
                      {current_API_KEYS_index === i ? (<Badge bg="primary" pill>{v}</Badge>) : <div>{v}</div>}
                    </div>
                  </ListGroup.Item>)
                  )}
                </ListGroup>
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="1">
              <Accordion.Header><Badge>{count_query}</Badge> Scaning: {chain}</Accordion.Header>
              <Accordion.Body>
                {address}<br />{privateKey}
                <Alert key={"danger"} variant={"danger"}>
                  {error}
                </Alert>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

        </Row>
        Good Wallets: <Badge>{goodWallets.length} </Badge>
        {/* <Row>
          <Col>address</Col>
          <Col>privateKey</Col>
          <Col>chain</Col>
          <Col>balance</Col>
        </Row> */}
        {
          goodWallets.map((v, i) =>
            <Row key={i}>
              {i}
              <Col><Form.Control value={v.address} readOnly /></Col>
              <Col><Form.Control value={v.privateKey} readOnly /></Col>
              <Col><Form.Control value={v.chain} readOnly /></Col>
              <Col><Form.Control value={v.balance} readOnly /></Col>
            </Row>
          )
        }
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
      </Container >
    );
  }
}
const styles = {
  isConnected: {
    textAlign: "center"
  }
}
export default App;
