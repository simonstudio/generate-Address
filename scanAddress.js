// const path = require("path");
const Web3 = require("web3");
const fs = require('fs');
var {log, success, error} = require("./myStd");
const clc = require("cli-color")

const express = require('express');
var cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);


var RUN = false;
var DAILY_TIME_RUN = "0:00:00";
var DAILY_TIME_RUN_FILE = "DAILY_TIME_RUN.txt";
var socket = null;
function ioemit(){
    if (io) io.emit(arguments);
}
function setDailyTimeRun(dailyTime = DAILY_TIME_RUN, file= DAILY_TIME_RUN_FILE){
    DAILY_TIME_RUN = dailyTime;
    fs.writeFile(file, dailyTime, {encoding: "utf8", flag: "w", mode: 0o666}, err => {
        if (err)
            error("setDailyTimeRun Error: ", err);
        else {
            fs.readFile(file, "utf8", (err, data)=>{
                success("set file " + file + " success: " + clc.yellow(data));
            })
        }
    })
}
function getDailyTimeRun(file = DAILY_TIME_RUN_FILE){
    fs.readFile(file, 'utf8', function(err, dailyTime){
        if (err)
            error("getDailyTimeRun error: ", err);
        else {
            DAILY_TIME_RUN = dailyTime;
            success(clc.yellow.bgRed(` ${dailyTime} `));
        }
    });
}
function timerRun(){
    let timer = setInterval(()=>{
        let now = new Date();
        let t = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
        if (t === DAILY_TIME_RUN){
            success(t)
            scanWallets(socket);
        }
    }, 1000)
}
getDailyTimeRun()
timerRun()

// var Logger = require('./Logger.js');
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, PutItemCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");

var INFURA_API_KEYS = [];
var current_INFURA_API_KEYS_index = 0;
const INFURA = [
    "https://mainnet.infura.io/v3/",
    "https://polygon-mainnet.infura.io/v3/",
    "https://optimism-mainnet.infura.io/v3/",
    "https://arbitrum-mainnet.infura.io/v3/",
    // "https://aurora-mainnet.infura.io/v3/",
    // "https://palm-mainnet.infura.io/v3/"
];
// Invalid JSON RPC response: {"size":0,"timeout":0}
var w3;

function loadInfuraAPIKeys(pathToFile ='infurakeys.txt'){
    return new Promise((rs,rj)=>{
        fs.readFile(pathToFile, 'utf8', (err, data) => {
            if (err) {
                error(err);
                rj(err);
            }else{
                INFURA_API_KEYS= data.split("\n").filter(v => v.trim() !== "").map(v => v.trim());
                rs(INFURA_API_KEYS);
            }
        });
    })
}

function initWeb3(index = 0) {
    current_INFURA_API_KEYS_index = index;
    w3 = INFURA.map(link => {
        const provider = new Web3.providers.HttpProvider(link + INFURA_API_KEYS[index]);
        return new Web3(provider);
    });
    w3.keyIndex = index;
    return w3;
}

async function random_wallet(web3) {
    let private_key = ""
    i = 0
    for (i = 0; i < 64; i++) {
        n = Math.floor(Math.random() * 0xf);
        if (n > 0xf) log("error: n > 0xf", n);
        private_key += n.toString(16);
    }
    let a = web3.eth.accounts.privateKeyToAccount(private_key);
    let { address, privateKey } = a;
    delete a;
    return { address, privateKey };
}

const client = new DynamoDBClient({ region: "ap-southeast-1" });

const createTables = () => {
    client.send(new ListTablesCommand({})).then(data => {
        const params = {
            AttributeDefinitions: [
                {
                    AttributeName: "address", //ATTRIBUTE_NAME_1
                    AttributeType: "S", //ATTRIBUTE_TYPE
                },
                {
                    AttributeName: "private", //ATTRIBUTE_NAME_2
                    AttributeType: "S", //ATTRIBUTE_TYPE
                },
            ],
            KeySchema: [
                {
                    AttributeName: "address", //ATTRIBUTE_NAME_1
                    KeyType: "HASH",
                },
                {
                    AttributeName: "private", //ATTRIBUTE_NAME_2
                    KeyType: "RANGE",
                },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
            TableName: "", //TABLE_NAME
            StreamSpecification: {
                StreamEnabled: false,
            },
        };
        ["addresses", "goodaddresses"].map(table => {
            if (!data.TableNames.includes(table)) {
                params.TableName = table;
                client.send(new CreateTableCommand(params)).then(result => {
                    log(table, " Table Created: ", result['$metadata'].httpStatusCode == 200)
                });
            }
        })

    });
}

const deleteTables = () => {
    ["addresses", "goodaddresses"].map(table => {
        client.send(new DeleteTableCommand({ TableName: table })).then(result => {
            log(table, " Success, table deleted: ", result['$metadata'].httpStatusCode == 200);
        }).catch(err => log(err.message));
    });
}

var TIMEOUT_QUERY = 100;
var count_query = 0;
const scanWallets = () => {
    // if (count_query > 1) return; // test
    if (!RUN) return;
    random_wallet(w3[0]) // {address:'0x550cd530bc893fc6d2b4df6bea587f17142ab64e', privateKey:'aaa'}
        .then(async (a) => {
            // const params = {
            //     TableName: "addresses",
            //     Item: {
            //         address: { S: a.address },
            //         private: { S: a.privateKey },
            //     },
            // };
            // client.send(new PutItemCommand(params)).then(resultA => {
            //     // log(resultA["$metadata"].httpStatusCode == 200)
            //     TIMEOUT_QUERY = 10;
            // }).catch(err => {
            //     error("Err: PutItemCommand table addresses: ", err);
            //     if (err.message === 'The level of configured provisioned throughput for the table was exceeded. Consider increasing your provisioning level with the UpdateTable API.')
            //         TIMEOUT_QUERY = 2000;
            // });

            // check address balance in multichain
            
            /* check balane */
            return w3.map((web3, web3Index) => {
                ioemit('count_query', {
                    count: count_query++,
                    address: a.address,
                    privateKey: a.privateKey,
                    current_INFURA_API_KEYS_index: current_INFURA_API_KEYS_index,
                    chain: w3[web3Index],
                });
                log(a.address);
                return web3.eth.getBalance(a.address).then(balance => {
                    // log(balance);
                    if (balance >= 1e18) {
                        let content = a.address + "," + a.privateKey + "\n";
                        log("Good Wallets: ", content);

                        // write to file
                        fs.open('walletsGoodjs.txt', "a+", (err, fd) => {
                            if (err) error(err);
                            else {
                                fs.appendFile(fd, content, (err) => {
                                    if (err)
                                        error("Error:", err);
                                });
                            }
                            fs.close(fd, () => { success("walletsGoodjs Saved OK"); })
                        });

                        const params = {
                            TableName: "goodaddresses",
                            Item: {
                                address: { S: a.address },
                                private: { S: a.privateKey },
                            },
                        };
                        // save to database
                        client.send(new PutItemCommand(params)).then(resultG => {
                            // log(resultG["$metadata"].httpStatusCode == 200);
                        });
                        ioemit('goodWallets', {
                            address: a.address,
                            privateKey: a.privateKey,
                            balance: balance,
                            chain: (new URL(web3._provider.host)).host.split(".")[0]
                        })
                        return a.privateKey;
                    } else
                        return 0;
                }).catch(err => {
                    error("get balance error: ", err.message);

                    if (err.message === 'Invalid JSON RPC response: {"size":0,"timeout":0}' || 
                        err.message ==='Returned error: daily request count exceeded, request rate limited'){
                        if (w3.keyIndex >= (INFURA_API_KEYS.length - 1)) {
                            // when all keys exceeded, set time run again next day

                            RUN = false;
                            ioemit("count_query", { error: `get balance error: ${err.message} - ${INFURA_API_KEYS[w3.keyIndex]}` , RUN: false });
                        } else {
                            initWeb3(w3.keyIndex + 1);
                        }
                        error("w3 api key: ", INFURA_API_KEYS[w3.keyIndex]);
                    }else {
                        RUN = false;
                        ioemit("count_query", { error: "get balance error: " + err.message, RUN: false });                          
                    }
                })
            });
        })
        .then((list) => setTimeout(() => {
            scanWallets()
        }, TIMEOUT_QUERY))
        .catch(err => {
            error("random_wallet: ", err);
            scanWallets();
        })
};

/* server */

var PORT = 3001;

app.use(cors());

io.on('connection', async (_socket) => {
    socket = _socket
    success('a user connected');
    socket.broadcast.emit('hi');
    socket.on("count_query", (msg) => {
        switch (msg) {
            case 'run_now':
                RUN = true;
                scanWallets(socket);
                break;
            case 'pause_now':
                RUN = false;
                break;
            case "get_state":
                break;
        }
        socket.emit("count_query", {
            "RUN": RUN,
            "DAILY_TIME_RUN": DAILY_TIME_RUN
        });
        log("count_query", msg, RUN);
    });

    socket.on("DAILY_TIME_RUN", msg => {
        switch (msg.command){
            case "set":
                setDailyTimeRun(msg.DAILY_TIME_RUN)
                break;
            case "get":
                break;
        }
        socket.emit("DAILY_TIME_RUN", {"DAILY_TIME_RUN": DAILY_TIME_RUN})
    });

    socket.on("INFURA_API_KEYS", (msg) => {
        if (msg.message)
            switch( msg.message ) {
                case "get_INFURA_API_KEYS":
                    socket.emit("INFURA_API_KEYS", {status: 200,message: "get_INFURA_API_KEYS", data: INFURA_API_KEYS});
                    break;
                case "set_INFURA_API_KEYS":
                    log(msg.INFURA_API_KEYS);
                    INFURA_API_KEYS = msg.INFURA_API_KEYS;
                    initWeb3()
                    socket.emit("INFURA_API_KEYS", {status: 200, message: "set_INFURA_API_KEYS"});
                    break;
            }
    })

    socket.on("goodWallets", (msg) => {
        switch (msg) {
            // case :
            // break;
        }
    });
});

server.listen(PORT, () => {
    log(`http://localhost:${PORT}`);
    loadInfuraAPIKeys().then((keys)=> {
        initWeb3()
    }) ;
});


/* test */ 

// deleteTables()
// createTables()