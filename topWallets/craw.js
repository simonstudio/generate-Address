var { log, logSuccess, logError, logWaning } = require("../myStd");
const cheerio = require('cheerio');
const request = require('request-promise');
const fs = require('fs')

var folder = "topWallets/"

var webSources = [
    'etherscan.io',
    'bscscan.com',
    'ftmscan.com',
    'polygonscan.com',
    'snowtrace.io',
    'celoscan.io',
    'optimistic.etherscan.io',
    'arbiscan.io',
    'gnosisscan.io',
    'aurorascan.dev',
    'moonscan.io',
    // 'https://www.hecoinfo.com/en-us/top-accounts',
]

function webSourcesLinks() {
    return webSources.map(v => `https://${v}/accounts/`)
}

var links = webSourcesLinks()

function saveToFile(addresses, fileName) {
    let file = folder + fileName
    fs.writeFileSync(file, addresses.join("\n") + "\n", { flag: "a+" })
    logSuccess(`saved ${file}`)
}

// craw 1 page
function craw(link) {
    return new Promise((rs, rj) => {
        let addresses = [];
        request(link, async (error, response, html) => {
            if (!error && response.statusCode == 200) {
                const $ = cheerio.load(html);
                let addresses = []
                await $("#ContentPlaceHolder1_divTable > table > tbody a").each((index, el) => addresses.push(el.children[0].data))
                rs(addresses)
            } else rj(error);
        })
    })
}

// craw from 1 chain
function craws(webSource, link, index = 400) {
    if (index > 0) {
        log(index)
        craw(link + index).then(addresses => {
            let file = folder + `${webSource}.txt`
            if (addresses.length === 0) {
                logError(webSource, link, index, addresses)
                fs.writeFile(file + ".miss", index + "\n", { flag: "a+" }, (err) => {
                    if (err) throw (err)
                    setTimeout(() => {
                        craws(webSource, link, (index - 1))
                    }, 500);
                })
            } else
                fs.writeFile(file, addresses.join("\n") + "\n", { flag: "a+" }, (err) => {
                    if (err) throw err;
                    setTimeout(() => {
                        craws(webSource, link, (index - 1))
                    }, 500);
                })
        })
    }
}

// recraw missing pages
function crawsMiss(webSource, pages, index = 0) {
    log(index)
    if (index < pages.length) {
        let page = pages[index]
        craw(`https://${webSource}/accounts/${page}`).then(addresses => {
            let file = folder + `${webSource}.txt`
            if (addresses.length === 0) {
                logError(webSource, pages, index, addresses)
                fs.writeFile(webSource + ".txt.miss", index + "\n", { flag: "w+" }, (err) => {
                    if (err) throw (err)
                    setTimeout(() => {
                        crawsMiss(webSource, pages, (index + 1))
                    }, 500);
                })
            } else
                fs.writeFile(file, addresses.join("\n") + "\n", { flag: "a+" }, (err) => {
                    if (err) throw err;
                    setTimeout(() => {
                        crawsMiss(webSource, pages, (index + 1))
                    }, 500);
                })
        })
    }
}

// craw 1-1 chains
function crawChains(links, index = 0) {
    if (index < links.length) {
        logWaning("crawing ", links[index])

        craws(webSources[index], links[index]).then(() => {
            crawChains(links, index + 1);
        })
    }
}

// craw chains in same time
links.map((link, i) => {
    // craws(webSources[i], link)
})

// craw 1-1 chains
// crawChains(links)


// recraw missing pages
links.map((link, i) => {
    let file = folder + webSources[i] + ".txt.miss"
    if (fs.existsSync(file)) {
        fs.readFile(file, 'utf8', (err, data) => {
            if (err) throw err;
            let pages = data.split("\n").filter(v => v.trim() !== "")
            log(file, pages)
            fs.unlinkSync(file);
            crawsMiss(webSources[i], pages)
        })
    }
})