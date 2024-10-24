const SessionCrypto = require("../sessionCrypto");
const Base64 = require("../sessionCrypto/base64");
const axios = require("axios");
const fs = require("fs");
const Utils = require("../utils");

class Bridge {
    constructor(url, wallet) {
        this.url = url;
        this.ttl = 300;
        this.timeout = 600;
        this.last_id = undefined;
        this.session = undefined;

        this.wallet = wallet;
        this.on_listen = false;
        this.controller = undefined;
        this.agent = undefined;
        this.interval = false;
        this.last_event_id = undefined;
        this.closed = false;
    }

    next_id() {
        if(this.last_rpc_id == undefined) {
            this.last_rpc_id = 0;
        }
        else {
            this.last_rpc_id += 1;
        }

        return this.last_rpc_id;
    }

    async connect(session) {
        if(session == undefined) {
            session = new SessionCrypto();
        }

        this.session = session;
        this.listen();
    }

    get_events_url() {
        let url = `${this.url}/events?client_id=${this.session.sessionId}`;
        if(this.last_event_id != undefined) url += `&last_event_id=${this.last_event_id}`;

        return url;
    }

    get_message_url(topic) {
        let url = `${this.url}/message?client_id=${this.session.sessionId}&to=${this.session.app_public_key}&ttl=${this.ttl}&topic=${topic}`;

        return url;
    }

    async listen() {
        if(this.get_events_url().includes("api-node.bybit.com")) return;
        if(this.on_listen) return;

        this.on_listen = true;

        if(this.agent == undefined) this.agent = Utils.getProxy();
        if(this.interval != undefined) {
            clearInterval(this.interval)
            this.interval = undefined;
        }

        let agent = this.agent;

        let oldController = this.controller;
        this.controller = new AbortController();

        let message = "";

        this.interval = setInterval(async () => {
            this.on_listen = false;
            this.listen();
        }, 30000);

        try {

            const stream = (await axios.get(this.get_events_url(), {
                responseType: "stream",
                headers: {
                    'Accept': 'text/event-stream',
                    "Origin": "https://app.ston.fi",
                    "Referer": "https://app.ston.fi/"
                },
                // httpsAgent: agent,
                signal: this.controller.signal,
                timeout: 30000
            })).data;

            if(oldController != undefined) await this.close(oldController);

            stream.on('data', (data) => {
                data = data.toString('utf8');
                let data2 = data.split("\n");

                let options = {};

                for(let i = 0; i < data2.length; i++) {
                    let splittedData = data2[i];
                    options[splittedData.split(": ")[0]] = splittedData.split(": ")[1];
                }

                if(options.event == "message") {
                    try {
                        if(options.id != undefined) this.last_event_id = options.id;

                        let eventParsed = JSON.parse(options.data);

                        message = "";

                        this.session.app_public_key = eventParsed.from;
                        this.wallet.on_message(eventParsed.from, JSON.parse(this.session.decrypt(Base64.decode(eventParsed.message).toUint8Array(), this.session.hexToByteArray(eventParsed.from))));
                    }
                    catch(error) {
                        message += options.data;
                    }

                    return;
                }

                if(options.event == "heartbeat") return;
                if(options.retry != undefined) return;
                if(data.replace(" ", "").length == 0) return;

                message += data;

                try {
                    let eventParsed = JSON.parse(message);

                    message = "";

                    this.session.app_public_key = eventParsed.from;
                    this.wallet.on_message(eventParsed.from, JSON.parse(this.session.decrypt(Base64.decode(eventParsed.message).toUint8Array(), this.session.hexToByteArray(eventParsed.from))));
                }
                catch {
                    //message += options.data;
                }
            });
        }
        catch(error) {
            if(this.controller?.signal?.abroted) return;
            if(this.closed) return;

            console.log(error)

            console.log(this.get_events_url())
            console.log(error.code);

            if(error.code?.includes("ERR_BAD_REQUEST")) return;
            if(error.code?.includes("ERR_BAD_RESPONSE")) return;



        }
    }

    async close(controller) {
        this.closed = true;

        if(controller != undefined) controller.abort();
        else if(this.controller != undefined) this.controller.abort();

        if(this.interval != undefined) clearInterval(this.interval)
    }

    async sendMessage(body) {
        let sent = false;
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

        while(!sent) {
            try {
                let url = this.get_message_url("sendTransaction");
                console.log(url);
                let agent = Utils.getProxy();

                let answer = await axios.post(url, Base64.encode(this.session.encrypt(JSON.stringify(body), this.session.hexToByteArray(this.session.app_public_key))), {
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        "Origin": "https://app.ston.fi",
                        "Referer": "https://app.ston.fi/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0"
                    },

                    timeout: 1000 * 20,
                    httpsAgent: this.agent,
                    httpAgent: this.agent,
                });

                console.log("request sent");
                sent = true;
            }
            catch(error) {
                console.log(error);

                await delay(100);
                //this.sendMessage(body);
            }
        }
    }
}

module.exports = Bridge;
