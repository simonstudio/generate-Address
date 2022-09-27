import React from 'react';
import { Container, Row, Col, ListGroup, Badge, Form, InputGroup, Button, Alert, Spinner, Accordion } from 'react-bootstrap';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const socket = io("http://localhost:3001");



const log = console.log;
const logError = console.error;

class App extends React.Component {
  state = {
    isConnected: false, RUN: false,
    lastPong: "none",
    DAILY_TIME_RUN: "0:0:0",
    INFURA_API_KEYS: [], currentINFURA_API_KEYSindex: 0,
    privateKey: "privateKey", chain: "chain"
  }

  componentDidMount() {
    socket.onAny((event, ...args) => {
      console.log(event, args);
    });

    socket.on('connect', () => {
      this.setState({ isConnected: true });
      socket.emit("INFURA_API_KEYS", { message: "get_INFURA_API_KEYS" })
      log("connected")

      socket.on("DAILY_TIME_RUN", msg => {
        // console.log(msg)
      })

      socket.on("INFURA_API_KEYS", (msg) => {
        if (msg.message)
          switch (msg.message) {
            case "get_INFURA_API_KEYS":
              if (msg.status === 200) {
                this.setState({ INFURA_API_KEYS: msg.data });
                // log(this.state.INFURA_API_KEYS);
              } else {
                logError(msg);
                toast.error("get_INFURA_API_KEYS error:");
              }
              break;
            case "set_INFURA_API_KEYS":
              if (msg.status === 200) {
                toast("set_INFURA_API_KEYS success");
              } else {
                logError(msg);
                toast.error("set_INFURA_API_KEYS success");
              }
              break;
          }
      })

      socket.on('count_query', msg => {
        this.setState({ RUN: msg.RUN });
        log(msg)
      })
    });

    socket.on('disconnect', () => {
      this.setState({ isConnected: false })
    });
  }
  
  onChangeDAILY_TIME_RUN(e) {
    console.log(e.target.value)
    this.setState({ DAILY_TIME_RUN: e.target.value })
  }

  setDAILY_TIME_RUN(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log(this.state.DAILY_TIME_RUN)
    // this.setState({ DAILY_TIME_RUN: e.target.value })
  }

  run() {
    if (!this.state.RUN)
      socket.emit('count_query', "run_now");
    else
      socket.emit('count_query', "pause_now")
  }
  render() {
    const { DAILY_TIME_RUN, RUN, isConnected, INFURA_API_KEYS, currentINFURA_API_KEYSindex, privateKey, chain } = this.state;
    let variant = isConnected ? 'success' : 'danger';
    return (
      <Container>
        <Row>
          <Form onSubmit={this.setDAILY_TIME_RUN.bind(this)}>
            <Form.Group className="mb-3">
              <Form.Label>
                <Spinner key={variant} variant={variant}> {isConnected ? 'connected' : 'disconnected'}</Spinner >
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
              <Accordion.Header><Badge>{INFURA_API_KEYS.length} API KEYS  </Badge> - {INFURA_API_KEYS[currentINFURA_API_KEYSindex]}</Accordion.Header>
              <Accordion.Body>
                <ListGroup as="ol">
                  {INFURA_API_KEYS.map((v, i) =>
                  (<ListGroup.Item as="li" className="d-flex justify-content-between align-items-start" key={i}>
                    {i} <div className="ms-2 me-auto">
                      <div className="fw-bold">{v}</div>
                    </div>
                    <Badge bg="primary" pill>  </Badge>
                  </ListGroup.Item>)
                  )}
                </ListGroup>
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="1">
              <Accordion.Header>Scaning {chain}</Accordion.Header>
              <Accordion.Body>
                {privateKey} - {chain}
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

export default App;
