const SessionCrypto = require("../sessionCrypto");
const Utils = require("../utils");
const Wallet = require("../wallet");
const Manifest = require("../manifest");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function encodeTelegramUrlParameters(parameters) {
    return parameters
        .replaceAll('.', '%2E')
        .replaceAll('-', '%2D')
        .replaceAll('_', '%5F')
        .replaceAll('&', '-')
        .replaceAll('=', '__')
        .replaceAll('%', '--');
}

class Client {
    constructor(manifest_url, ton_proof, on_connect, session) {
        this.session = session;
        this.wallet = undefined;
        this.manifest_url = manifest_url;
        this.ton_proof = ton_proof;

        this.universal_url = undefined;
        this.deep_url = undefined;
        this.tc_url = undefined;

        this.transactions = {}
        this.transaction_answers = {}

        this.on_connect = (...args) => {
            on_connect(this, ...args);
        };
    }
    
    async connect(app_name, ws, key) {
        if(app_name == "tonkeeper_ext") {
            this.wallet = new Wallet("tonkeeper_ext", undefined, this, ws, key);
            this.bridge = this.wallet.bridge;
            this.metadata = new Manifest(this.manifest_url, this.ton_proof);

            this.bridge.connect();

            return;
        }

        let apps = await Utils.getWallets();
        let bridge, app, wallet;

        for(let i = 0; i < apps.length; i++) {
            let app_i = apps[i];
            if(app_i.app_name == app_name) {
                app = app_i;
                break;
            }
        }

        if(app == undefined) throw new Error(`wallet with app_name -> ${app_name} not found`);
        bridge = app.bridge.filter(bridge => bridge.type == "sse")[0];

        this.wallet = new Wallet(app, bridge, this);
        this.bridge = this.wallet.bridge;
        this.metadata = new Manifest(this.manifest_url, this.ton_proof);

        this.bridge.connect(this.session);
        this.tc_url = this.wallet.get_tc_url(this.metadata.to_dict());

        if(app_name != "telegram-wallet") {
            this.universal_url = this.wallet.get_universal_url(this.metadata.to_dict());
            this.deep_url = this.wallet.get_deep_url(this.metadata.to_dict());

            return;
        }

        
        this.universal_url = this.wallet.get_universal_url(this.metadata.to_dict());
        this.deep_url = this.wallet.get_deep_url(this.metadata.to_dict());

        let dictMetadata = JSON.stringify(this.metadata.to_dict()).replace(" ", "").replace("\'", "\"");
        
        const startapp = 'tonconnect-' + encodeTelegramUrlParameters(`v=2&id=${this.bridge.session.sessionId}&r=${encodeURIComponent(dictMetadata)}&ret=none`);

        this.universal_url = `https://t.me/wallet/start?startapp=${startapp}`;
        this.deep_url = undefined;
    }

    async sendTransaction(params) {
        let id;
        try {
            id = this.wallet.bridge.next_id();

            let body = {
                method: "sendTransaction",
                "params": [JSON.stringify(params)],
                id: id.toString()
            }
            
            this.transactions[id] = params;
            await this.bridge.sendMessage(body);
        }
        catch(error) {
            console.log(error);
            return {
                "error": true
            }
        }

        while(this.transaction_answers[id] == undefined) await delay(1000);

        let answer = this.transaction_answers[id];
        delete this.transaction_answers[id];

        console.log(answer.error);

        if(answer.error != undefined) throw new Error(answer.error.message);
        return answer.result;
    }
}

module.exports = Client;