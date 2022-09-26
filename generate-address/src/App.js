import React from 'react';
import { Container, Row, Col, ListGroup, Badge, Form } from 'react-bootstrap';
import io from 'socket.io-client';

import './App.css';

const socket = io();

class App extends React.Component {
  state = {
    isConnected: false,
    lastPong: "none",
    startTime: "0:0:0",
    
  }

  componentDidMount() {
    socket.on('connect', () => {
      this.setState({ isConnected: true })
    });

    socket.on('disconnect', () => {
      this.setState({ isConnected: false })
    });

    socket.on('pong', () => {
      this.setState({ lastPong: new Date().toISOString() });
    });

  }
  setStartTime(e) {
    console.log(e.target.value)
    this.setState({ startTime: e.target.value })
  }
  render() {
    const { startTime } = this.state;
    return (
      <Container>
        <Row>
          <Col><ListGroup as="ol" numbered>
            <Form>
              <Form.Group className="mb-3" controlId="formBasicEmail">
                <Form.Label>Start Time (0:0:0)</Form.Label>
                <Form.Control placeholder="0:0:0" value={startTime} onChange={this.setStartTime.bind(this)} />
              </Form.Group>
            </Form>
            <ListGroup.Item as="li" className="d-flex justify-content-between align-items-start">
              <div className="ms-2 me-auto">
                <div className="fw-bold">current API key</div>
                0x...
              </div>
              <Badge bg="primary" pill>
                14
              </Badge>
            </ListGroup.Item>


          </ListGroup> </Col>
        </Row>
      </Container>
    );
  }
}

export default App;
