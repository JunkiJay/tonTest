const Bridge = require("../bridge");
const Utils = require("../utils");
const ExtensionBridge = require("../bridge/extension");

class Wallet {
    constructor(app, bridge, client, ws, key) {
        if(app == "tonkeeper_ext") {
            this.app = app;
            this.bridge = new ExtensionBridge(ws, key, this);
            this.timeout = 600;
    
            this.address = undefined;
            this.appVersion = undefined;
            this.platform = undefined;
            this.appName = undefined;
    
            this.client = client;

            return;
        }

        this.app = app;
        this.bridge = new Bridge(bridge.url, this);
        this.timeout = 600;

        this.address = undefined;
        this.appVersion = undefined;
        this.platform = undefined;
        this.appName = undefined;

        this.client = client;
    }

    async on_message(from, data) {
        if(data.event == "connect") { 
            for(let i = 0; i < data.payload.items.length; i++) {
                let item = data.payload.items[i];
                if(item.name == "ton_addr") this.address = item.address;
            }
            
            data.payload.device.features.forEach(element => {
                if(element.name == "SendTransaction") this.maxMessages = element.maxMessages;
            });

            this.appVersion = data.payload.device.appVersion;
            this.appName = data.payload.device.appName;
            this.platform = data.payload.device.platform;
            
            this.client.on_connect(data);

            return;
        }

        if(data.id != undefined) {
            this.client.transaction_answers[data.id] = data;
            return;
        }       
    }

    get_universal_url(metadata) {
        return Utils.generateUrl(this.app.universal_url, this.bridge.session.sessionId, metadata);
    }
    
    get_deep_url(metadata) {
        if(this.app.deepLink == undefined) return undefined;
        return Utils.generateUrl(this.app.deepLink, this.bridge.session.sessionId, metadata);
    }
    
    get_tc_url(metadata) {
        return Utils.generateUrl("tc://", this.bridge.session.sessionId, metadata);
    }
}

module.exports = Wallet;