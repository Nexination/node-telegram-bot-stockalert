"use strict";
class StockAlertBot {
  constructor() {
    this.lib = {};
    this.lib.https = require('https');
    this.lib.fs = require('fs');
    this.lib.fileUnitFiler = new (require('fileunit').Filer)('data');
    this.lib.telegram = {};
    
    this.data = {
      "token": ""
      , "users": {
        "1880667": {
          "stocks":[
            "GOLD"
          ]
        }
      }
      , "stockStore": {
        "GOLD": 0.3
      }
    };
    this.lib.fileUnitFiler.load((readError, fileData) => {this.runAfterLoad(readError, fileData);});
  }
  chatCheck(chatId) {
    if(!this.data.users.hasOwnProperty(chatId)) {
      this.data.users[chatId] = {};
    };
    
    return this.data.users[chatId];
  }
  start(result) {
    let chatSettings = this.chatCheck(result.message.chat.id);
    
    this.lib.telegram.apiCall(
      'sendMessage'
      , {
        "chatId": result.message.chat.id
        , "encodedMessage": "Welcome " + result.message.from.username + " this is your automated stock bot!\n"
        + "It uses yahoo finance and it alerts you on a 0.1% change in the stock, be it up or down.\n"
        + "Please check /help before you try to use the bot."
      }
    );
    return false;
  }
  help(result) {
    let chatSettings = this.chatCheck(result.message.chat.id);
    
    this.lib.telegram.apiCall(
      'sendMessage'
      , {
        "chatId": result.message.chat.id
        , "encodedMessage": "This bot uses yahoo finance.\n"
        + "To use this stock alert bot,\n"
        + "find stock id's on yahoo like so: http://finance.yahoo.com/q?s=eurusd=x\n"
        + "The stock id is the name in the brackets,\n"
        + "or part of the url like \"(EURUSD=X)\".\n\n"
        + "Command list:\n"
        + "/start - Greeting message\n"
        + "/help - Show this help window\n"
        + "/settings - Show your added stocks and other info\n"
        + "/stockadd - Add a stock to alerts\n"
        + "/stockremove - Remove a stock from alerts\n"
        + "/cancel - Cancels any ongoing action\n\n"
        + "If you have problems with this product, please visit us on https://github.com/Nexination/node-telegram-bot-collection"
      }
    );
    return false;
  }
  settings(result) {
    let chatSettings = this.chatCheck(result.message.chat.id);
    
    let textSettings = '';
    for(let i in chatSettings) {
      textSettings += '- ' + i + '\n' + JSON.stringify(chatSettings[i]);
    };
    
    this.lib.telegram.apiCall(
      'sendMessage'
      , {
        "chatId": result.message.chat.id
        , "encodedMessage": "Your settings: \n"
        + (textSettings !== '' ? textSettings : 'none')
      }
    );
    return false;
  }
  stockAdd(result) {
    let chatSettings = this.chatCheck(result.message.chat.id);
    
    if(result.message.text.substr(0, 1) === '/') {
      this.lib.telegram.deferAction(result.message.chat.id, (result) => {this.stockAdd(result);});
      this.lib.telegram.apiCall(
        'sendMessage'
        , {
          "chatId": result.message.chat.id
          , "encodedMessage": "Please input the stock id you wish to add:"
        }
      );
    }
    else {
      let stock = result.message.text.toUpperCase();
      if(/^[a-zA-Z0-9\.\=]+$/gi.test(stock)) {
        if(!chatSettings.hasOwnProperty('stocks')) {
          chatSettings.stocks = [];
        };
        chatSettings.stocks.push(stock);
        if(!this.data.stockStore.hasOwnProperty(stock)) {
          this.data.stockStore[stock] = 0;
        };
        this.lib.telegram.apiCall(
          'sendMessage'
          , {
            "chatId": result.message.chat.id
            , "encodedMessage": "Stock " + stock + " confirmed."
          }
        );
        this.lib.fileUnitFiler.save(JSON.stringify(this.data));
      }
      else {
        this.lib.telegram.apiCall(
          'sendMessage'
          , {
            "chatId": result.message.chat.id
            , "encodedMessage": "Wrong stock format!"
          }
        );
      };
    };
    
    return false;
  }
  stockRemove(result) {
    let chatSettings = this.chatCheck(result.message.chat.id);
    
    if(result.message.text.substr(0, 1) === '/') {
      this.lib.telegram.deferAction(result.message.chat.id, (result) => {this.stockRemove(result);});
      this.lib.telegram.apiCall(
        'sendMessage'
        , {
          "chatId": result.message.chat.id
          , "encodedMessage": "Please input the stock id you wish to remove:"
        }
      );
    }
    else {
      if(chatSettings.hasOwnProperty('stocks')) {
        let stockPlace = chatSettings.stocks.indexOf(result.message.text.toUpperCase());
        if(stockPlace !== -1) {
          let removedItem = chatSettings.stocks.splice(stockPlace, 1);
          this.lib.telegram.apiCall(
            'sendMessage'
            , {
              "chatId": result.message.chat.id
              , "encodedMessage": "Stock " + JSON.stringify(removedItem) + " removed."
            }
          );
          this.lib.fileUnitFiler.save(JSON.stringify(this.data));
        }
        else {
          this.lib.telegram.apiCall(
            'sendMessage'
            , {
              "chatId": result.message.chat.id
              , "encodedMessage": "Stock " + result.message.text + " not found."
            }
          );
        };
      };
    };
    
    return false;
  }
  deferredActionCancel(result) {
    this.lib.telegram.deferActionRemove(result.message.chat.id);
    this.lib.telegram.apiCall(
      'sendMessage'
      , {
        "chatId": result.message.chat.id
        , "encodedMessage": "Action cancelled."
      }
    );
    return false;
  }
  getStockUpdates() {
    let now = new Date();
    console.log('---UPDATING STOCKS---' + now.toISOString());
    let callUrl = 'https://query.yahooapis.com/v1/public/yql?q=select%20Symbol,PercentChange%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22YHOO%22${target})&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys';
    let stocksToBeCounted = '';
    
    this.cleanUpUsers();
    
    for(let stock in this.data.stockStore) {
      stocksToBeCounted += ',%22' + stock + '%22';
    };
    callUrl = callUrl.replace('${target}', stocksToBeCounted);
    
    this.lib.https.get(callUrl, (resource) => {this.stockDataHandler(resource);}).on('error', function(e) {
      console.error(e);
    });
    
    return false;
  }
  stockDataHandler(resource) {
    let data = '';
    resource.on('data', (chunk) => {
      data += chunk;
    });
    resource.on('end', () => {
      let jsonData = {};
      try {
        jsonData = JSON.parse(data);
      } catch(error) {
        console.log(error);
      };
      if(jsonData.hasOwnProperty('query')) {
        if(jsonData.query.hasOwnProperty('results')) {
          for(let i = 0; i < jsonData.query.results.quote.length; i += 1) {
            let quote = jsonData.query.results.quote[i];
            console.log(quote.PercentChange);
            if(quote.Symbol !== 'YHOO') {
              if(quote.PercentChange !== null) {
                let currentQuote = Math.floor(parseFloat(quote.PercentChange.substr(0, quote.PercentChange.length-1)) * 10) / 10;
                if(this.data.stockStore[quote.Symbol] !== currentQuote) {
                  console.log(quote.Symbol + ' ' + currentQuote);
                  this.data.stockStore[quote.Symbol] = currentQuote;
                  this.alarmUsers(quote);
                };
              }
              else {
                console.log('Deleted ' + quote.Symbol);
                delete this.data.stockStore[quote.Symbol];
              };
            };
          };
          this.lib.fileUnitFiler.save(JSON.stringify(this.data));
        };
      };
    });
    return false;
  };
  alarmUsers(quote) {
    for(let chatId in this.data.users) {
      if(this.data.users[chatId].hasOwnProperty('stocks')) {
        if(this.data.users[chatId].stocks.indexOf(quote.Symbol) !== -1) {
          this.lib.telegram.apiCall(
            'sendMessage'
            , {
              "chatId": chatId
              , "encodedMessage": "!ALERT! " + quote.Symbol + " has changed " + quote.PercentChange
            }
          );
        };
      };
    };
    return false;
  };
  cleanUpUsers() {
    for(let chatId in this.data.users) {
      let deleteUser = false;
      if(this.data.users[chatId].hasOwnProperty('stocks')) {
        let stocks = this.data.users[chatId].stocks;
        if(stocks.length === 0) {
          deleteUser = true;
        }
        else {
          for(let i = 0; i < stocks.length; i += 1) {
            if(this.data.stockStore[stocks[i]] === undefined) {
              stocks.splice(i, 1);
            };
          };
        };
      }
      else {
        deleteUser = true;
      };
      
      if(deleteUser) {
        console.log('Deleting user ' + chatId);
        delete this.data.users[chatId];
      };
    };
    
    this.lib.fileUnitFiler.save(JSON.stringify(this.data));
    return false;
  };
  alertAllUsers() {
    let updateFileName = 'update';
    if(this.lib.fs.existsSync(updateFileName)) {
      this.lib.fs.readFile(
        'update'
        , (error, data) => {
          if(!error) {
            let update = JSON.parse(data);
            if(update.hasOwnProperty('news')) {
              for(let i in this.data.users) {
                this.lib.telegram.apiCall(
                  'sendMessage'
                  , {
                    "chatId": i
                    , "encodedMessage": update.news
                  }
                );
              };
            };
          };
        }
      );
    };
    return false;
  }
  runAfterLoad(readError, fileData) {
    if(!readError) {
      this.data = JSON.parse(fileData);
      console.log(this.data);
      this.lib.telegram = new (require('telegram-bot-manager').BotManager)({
        "botToken": this.data.token
        , "type": "webhook"
        , "key": this.data.key
        , "cert": this.data.cert
        , "receiver": {
          "port": 8083
          , "protocol": "http"
          , "endpoint": this.data.endpoint
        }
      });

      this.lib.telegram.on('start', (result) => {this.start(result);});
      this.lib.telegram.on('help', (result) => {this.help(result);});
      this.lib.telegram.on('settings', (result) => {this.settings(result);});
      this.lib.telegram.on('stockadd', (result) => {this.stockAdd(result);});
      this.lib.telegram.on('stockremove', (result) => {this.stockRemove(result);});
      this.lib.telegram.on('cancel', (result) => {this.deferredActionCancel(result);});

      this.alertAllUsers();
      this.getStockUpdates();
      setInterval(() => {this.getStockUpdates();}, (5*60*1000));
    }
    else {
      throw readError;
    };
    return false;
  }
};

let stockAlertBot = new StockAlertBot();