const axios = require("axios");

class TonKeeper {
    static apiKey = undefined;
    static initialized = false;

    static async initialize() {
        if(!this.initialized) TonKeeper.apiKey = await TonKeeper.getApiKey();
        this.initialized = true;
    }

    static async getApiKey() {
        return (await axios.get("https://boot.tonkeeper.com/keys?lang=en&build=3.10.04&chainName=mainnet&platform=web", {headers: {"Authorization": `Bearer ${this.apiKey}`}})).data.tonApiV2Key;
    }

    static async getAccountInfo(address) {
        return (await axios.get(`https://keeper.tonapi.io/v2/accounts/${address}`, {headers: {"Authorization": `Bearer ${this.apiKey}`}})).data;
    }

    static async getTonPrice() {
        return (await axios.get(`https://keeper.tonapi.io/v2/rates?tokens=TON&currencies=USD`, {headers: {"Authorization": `Bearer ${this.apiKey}`}})).data.rates.TON.prices.USD;
    }

    static async getAccountJettons(address) {
        return (await axios.get(`https://keeper.tonapi.io/v2/accounts/${address}/jettons?currencies=TON`, {headers: {"Authorization": `Bearer ${this.apiKey}`}})).data.balances;
    }
    
    static async getAccountNfts(address) {
        return (await axios.get(`https://keeper.tonapi.io/v2/accounts/${address}/nfts?limit=1000&offset=0&indirect_ownership=false`, {headers: {"Authorization": `Bearer ${this.apiKey}`}})).data.nft_items;
    }
}

module.exports = TonKeeper;