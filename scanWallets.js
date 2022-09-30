// const path = require("path");
var request = require("request");
const Web3 = require("web3");
const fs = require('fs');
var { log, logSuccess, logError, logWaning } = require("./myStd");
const clc = require("cli-color")

const io = require("socket.io")(3001, {
    path: "/",
    serveClient: false,
    cors: {
        origin: "http://localhost",
        methods: ["GET", "POST"]
    },
    // below are engine.IO options
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false
});

const { DynamoDBClient, CreateTableCommand, DeleteTableCommand, PutItemCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-1" });


var RUN = false;
var DAILY_TIME_RUN = "0:0:0";
var DAILY_TIME_RUN_FILE = "DAILY_TIME_RUN.txt";
var socket = null;

var TIMEOUT_QUERY = 100;
var count_query = 0;

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

var web3s;

var telegram = {}


function ioemit() {
    if (io) io.emit(arguments);
}

function socketemit() {
    if (socket) socket.emit(arguments);
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

async function setDailyTimeRun(dailyTime = DAILY_TIME_RUN, file = DAILY_TIME_RUN_FILE) {
    DAILY_TIME_RUN = dailyTime;
    fs.writeFileSync(file, dailyTime, { encoding: "utf8", flag: "w", mode: 0o666 })
    logSuccess("set file " + file + " success: " + clc.yellow(dailyTime));
}

async function getDailyTimeRun(file = DAILY_TIME_RUN_FILE) {
    if (!fs.existsSync(file)) {
        await setDailyTimeRun()
        return DAILY_TIME_RUN;
    } else {
        DAILY_TIME_RUN = fs.readFileSync(file, 'utf8')
        logSuccess(clc.yellow.bgRed(` ${DAILY_TIME_RUN} `));
        return DAILY_TIME_RUN;
    }
}

function loadInfuraAPIKeys(pathToFile = 'infurakeys.txt') {
    return new Promise((rs, rj) => {
        fs.readFile(pathToFile, 'utf8', (err, data) => {
            if (err) {
                logError(err);
                rj(err);
            } else {
                INFURA_API_KEYS = data.split("\n").filter(v => v.trim() !== "").map(v => v.trim());
                rs(INFURA_API_KEYS);
            }
        });
    })
}

async function initWeb3(index = 0) {
    current_INFURA_API_KEYS_index = index;
    log(index)
    web3s = INFURA.map(link => {
        const provider = new Web3.providers.HttpProvider(link + INFURA_API_KEYS[index]);
        return new Web3(provider);
    });
    web3s.keyIndex = index;
    return web3s;
}

async function loadGoodWallets(file = "walletsGoodjs.json") {
    let data = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' });
    return data.split("\n").filter(line => line.trim() !== "").map(line => JSON.parse(line))
}

function discoveredGoodWallet(address, privateKey, balance, web3) {
    let chain = (new URL(web3._provider.host)).host.split(".")[0]
    let content = `{"address":"${address}", "privateKey": "${privateKey}", "chain": "${chain}", "balance": ${balance}}\n`;
    log("Good Wallets: ", content);

    // write to file
    fs.open('walletsGoodjs.json', "a+", (err, fd) => {
        if (err) logError(err);
        else {
            fs.appendFile(fd, content, (err) => {
                if (err)
                    logError("Error:", err);
            });
        }
        fs.close(fd, () => { logSuccess("walletsGoodjs Saved OK"); })
    });

    sendMessage(content)

    const params = {
        TableName: "goodwallets",
        Item: {
            address: { S: address },
            privateKey: { S: privateKey },
            balance: { N: balance },
            chain: { S: chain }
        },
    };
    // save to database
    client.send(new PutItemCommand(params)).then(resultG => {
        // log(resultG["$metadata"].httpStatusCode == 200);
    }).catch(err => {
        logError(err.message)
    });

    ioemit('goodWallets', {
        newGoodWallets: {
            address: address,
            privateKey: privateKey,
            balance: balance,
            chain: chain
        }
    })
}

function loadTelegram(file = "telegram.json") {
    telegram = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' })
    return telegram;
}

function sendMessage(message) {

    let options = {
        method: 'POST',
        url: `https://api.telegram.org/bot${telegram.token}/sendMessage`,
        qs: { text: message, chat_id: telegram.chat_id },
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        logError(error)
    });

}

const scanWallets = () => {
    if (!RUN) return;
    random_wallet(web3s[0]) // {address:'0x550cd530bc893fc6d2b4df6bea587f17142ab64e', privateKey:'aaa'}
        .then(async (a) => {
            // check address balance in multichain
            /* check balane */
            return web3s.map((web3, web3Index) => {
                setTimeout(() => {

                    ioemit('count_query', {
                        count: count_query++,
                        address: a.address,
                        privateKey: a.privateKey,
                        current_INFURA_API_KEYS_index: current_INFURA_API_KEYS_index,
                        chain: (new URL(web3._provider.host)).host.split(".")[0],
                        RUN: RUN,
                    });

                    // log(web3s[web3Index]._provider.host);
                    return web3.eth.getBalance(a.address).then(balance => {
                        // log(balance);
                        if (balance >= 1e18) {
                            discoveredGoodWallet(a.address, a.privateKey, balance, web3);
                            return a.privateKey;
                        } else
                            return 0;
                    }).catch(err => {
                        if (err.message === 'Returned error: daily request count exceeded, request rate limited') {
                            if (current_INFURA_API_KEYS_index >= (INFURA_API_KEYS.length - 1)) {
                                RUN = false;
                                throw new Error("exceeded")
                                // when all keys exceeded, set time run again next day
                            } else {
                                initWeb3(current_INFURA_API_KEYS_index++);
                            }
                            logError("INFURA_API_KEYS exceeded: ", INFURA_API_KEYS[current_INFURA_API_KEYS_index]);
                        } else {
                            logError("get balance error: ", err.message);
                        }
                        ioemit("count_query", { error: `get balance error: ${err.message} - ${INFURA_API_KEYS[current_INFURA_API_KEYS_index]}`, RUN: RUN });
                    })
                }, 10 * web3Index);
            })
        })
        .then((allChains) => setTimeout(() => {
            scanWallets()
        }, TIMEOUT_QUERY))
        .catch(err => {
            if (err.message !== 'exceeded')
                logError("random_wallet: ", err);
            else scanWallets();
        })
};

// auto run at time
function timerRun() {
    let timer = setInterval(() => {
        let now = new Date();
        let t = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
        if (t === DAILY_TIME_RUN) {
            logSuccess("Start run scan: ", t)
            RUN = true;
            scanWallets();
        }
    }, 1000)
}

/*******/
/* init app */
loadTelegram()
loadInfuraAPIKeys()
    .then(keys => initWeb3())
    .then(web3s => getDailyTimeRun())
    .then(timerRun)

io.on('connection', async (_socket) => {
    socket = _socket;

    logSuccess(socket.id)
    socket.on("count_query", async (msg) => {
        switch (msg) {
            case 'run_now':
                RUN = true;
                logWaning("Start scan: ", (new Date()).toTimeString())
                scanWallets();
                break;
            case 'pause_now':
                RUN = false;
                logError("Stop scan: ", (new Date()).toTimeString())
                break;
            case "get":
                break;
        }
        socket.emit("count_query", {
            "RUN": RUN,
            "count_query": count_query,
        });
        // log("count_query", msg, RUN);
    });

    socket.on("DAILY_TIME_RUN", msg => {
        switch (msg.command) {
            case "set":
                setDailyTimeRun(msg.DAILY_TIME_RUN)
                socket.emit("DAILY_TIME_RUN", {
                    status: "SUCCESS", DAILY_TIME_RUN: DAILY_TIME_RUN, message: "set DAILY_TIME_RUN success"
                })
                log(msg)
                break;
            case "get":
                socket.emit("DAILY_TIME_RUN", { "DAILY_TIME_RUN": DAILY_TIME_RUN })
                break;
        }
    });

    socket.on("INFURA_API_KEYS", (msg) => {
        if (msg.command)
            switch (msg.command) {
                case "get":
                    socket.emit("INFURA_API_KEYS", { INFURA_API_KEYS: INFURA_API_KEYS, current_INFURA_API_KEYS_index: current_INFURA_API_KEYS_index });
                    break;
                case "set":
                    log(msg.INFURA_API_KEYS);
                    INFURA_API_KEYS = msg.INFURA_API_KEYS;
                    initWeb3()
                    socket.emit("INFURA_API_KEYS", { message: "SUCCESS" });
                    break;
            }
    })

    socket.on("goodWallets", (msg) => {
        loadGoodWallets().then(wallets => {
            socket.emit('goodWallets', { goodWallets: wallets })
        })
    });
});

// let mylink = INFURA[0] + INFURA_API_KEYS[5]
// logError(mylink)
// const myprovider = new Web3.providers.HttpProvider(mylink);
// (new Web3(myprovider)).eth.getBalance("0x554f4476825293d4ad20e02b54aca13956acc40a").then(balance => {
//     logSuccess(balance, '0x554f4476825293d4ad20e02b54aca13956acc40a')
// })

