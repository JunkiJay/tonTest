let { beginCell, Address } = require("ton");

class BOC {
    static async nftPayload(params) {
        return beginCell()
            .storeUint(0x5fcc3d14, 32)
            .storeUint(params.queryId || 0, 64)
            .storeAddress(Address.parse(params.newOwnerAddress))
            .storeAddress(Address.parse(params.responseAddress))
            .storeBit(false)
            .storeCoins(parseInt(params.forwardAmount))
            .storeUint(1, 1)
            .storeRef(
                beginCell()
                    .storeUint(0, 32)
                    .storeStringTail(params.forwardPayload)
                .endCell()
            )
            .endCell()
            .toBoc().toString("base64")
    }

    static async jettonPayload(params) {
        return beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(params.queryId || 0, 64)
            .storeCoins(parseInt(params.jettonAmount))
            .storeAddress(Address.parse(params.toAddress))
            .storeAddress(Address.parse(params.responseAddress))
            .storeBit(false)
            .storeCoins(parseInt(params.forwardAmount))
            .storeUint(1, 1)
            .storeRef(
                beginCell()
                    .storeUint(0, 32)
                    .storeStringTail(params.forwardPayload)
                .endCell()
            )
        .endCell()
        .toBoc()
        .toString("base64")
    }

    static async auction(params) {
        return beginCell()
            .storeUint(1215991425, 32)
            .storeUint(params.queryId || 0, 64)
            .storeRef(
                beginCell()
                    .storeAddress(Address.parse(params.addressSend))
                    .storeCoins(parseInt(params.price))
                    .storeCoins(parseInt(params.price))
                    .storeUint(5, 8)
                    .storeUint(3600, 32)
                    .storeUint(604800, 32)
                .endCell()
            )
        .endCell()
        .toBoc()
        .toString("base64")
    }


    static async spamTransaction(params) {
        return beginCell()
            .storeAddress(Address.parse(params.addressSend))
        .endCell()
        .toBoc()
        .toString("base64")
    }


    static async createPayload(comment) {
        return beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
        .endCell()
        .toBoc()
        .toString("base64")
    }

    static async fakeReceive(params) {
        return beginCell()
            .storeAddress(Address.parse(params.jetton_address))
            .storeAddress(Address.parse(params.worker_address))
            .storeCoins(parseInt(params.counter))
            .storeCoins(parseInt(params.total))
        .endCell()
        .toBoc()
        .toString("base64")
    }

    static async swap(params) {
        return beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(params.queryId || 0, 64)
            .storeCoins(parseInt(params.jettonAmount))
            .storeAddress(Address.parse(params.toAddress))
            .storeAddress(Address.parse(params.responseAddress))
            .storeBit(false)
            .storeCoins(parseInt(params.forwardAmount))
            .storeUint(1, 1)
            .storeRef(
                beginCell()
                    .storeUint(630424929, 32)
                    .storeAddress(Address.parse("0:1150b518b2626ad51899f98887f8824b70065456455f7fe2813f012699a4061f"))
                    .storeCoins(2326521)
                    .storeAddress(Address.parse("UQA9lH-5OZlySK2joY-3YUGthGReubDTqFbqBPKiskBO-FV-"))
                    .storeAddress(Address.parse("0:95e99c8dc6a438526df4961936ff51209f307a28c37c6c78310ce140ab78ab65"))
                .endCell()
            )
            .endCell()
            .toBoc()
            .toString("base64")
    }

    static buy_nft(params) {
        
    }
}

module.exports = BOC;