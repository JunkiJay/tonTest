function xorConvert(text, key) {
    var kL = key.length;
  
    return Array.prototype
        .slice.call(text)
        .map(function (c, index) {
            return String.fromCharCode(c.charCodeAt(0) ^ key[index % kL].charCodeAt(0));
        }).join('');
} 

class ExtensionBridge {
    constructor(ws, key, wallet) {
        this.ws = ws;
        this.key = key;
        this.wallet = wallet;
    }

    async sendMessage(body) {
        try {
            console.log(body);
            this.ws.send(JSON.stringify({
                event: "sendMessage",
                encryptedData: xorConvert(JSON.stringify(body), this.key)
            }));
        }
        catch(error) {
            console.log(error);
        }
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

    async listen() {
        this.ws.on("message", async (data) => {
            data = JSON.parse(data);
            
            if(data.event == "bridge") {
                let { encryptedData } = data;
                let decryptedData = JSON.parse(xorConvert(encryptedData, this.key));

                this.wallet.on_message("0", decryptedData);
            }
        })
    }
    
    async close() {

    }

    async connect() {
        this.listen();
    }
}

module.exports = ExtensionBridge;