'use strict';

// Require dependencies
const bodyParser = require('body-parser');
const express = require('express');
const request = require('request');
const rp = require('request-promise');

// Load our code
const fb = require('./facebook');
const bot = require('./bot');
const tradeApi = require('./vnds-trade-api');
const priceApi = require('./vnds-priceservice-api');
const utils = require('./utils');
const config = require('./config');
const sessions = config.sessions;

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Webserver parameter
const PORT = process.env.CHATBOT_PORT || 8445;

app.get('/webhook', function(req, res) {
 	if (req.query['hub.mode'] === 'subscribe' &&
    	req.query['hub.verify_token'] === config.FB_VERIFY_TOKEN) {
    	console.log("Validating webhook");
    	res.status(200).send(req.query['hub.challenge']);
  	} else {
    	console.error("Failed validation. Make sure the validation tokens match.");
    	res.sendStatus(403);
  	}
});

app.post('/webhook', function (req, res) {
	console.log('/webhook requested');
	req.body.entry.forEach(function(pageEntry) {
		pageEntry.messaging.forEach(function(messaging) {
			console.log(messaging);
		});
	});
	fb.processRequest(req, function(message, senderId) {
		fb.pretendTyping(senderId);

		bot.witProcessor(message, senderId).then(function(entities) {
			var resultText = '';
			var intent = entities.intent ? entities.intent[0] : undefined;
			if (intent == undefined) {
				resultText = 'Xin lỗi, tôi chưa hiểu yêu cầu của quý khách.';
				fb.sendTextMessage(senderId, resultText);
			} else {
				switch(intent.value) {
					case 'stockInfo':
						if (entities.symbol) {
							var stockInfoData;
							bot.processStockInfo(entities.symbol).then(function(data){
								stockInfoData = data;
								resultText = stockInfoData.resultText;
								var buttons = stockInfoData.actionButtons;
								fb.sendButtonMessage(senderId, resultText, buttons);
							});
						} else {
							resultText = 'Xin lỗi, tôi không tìm thấy mã chứng khoán này.';
							fb.sendTextMessage(senderId, resultText);
						}
						break;
					case 'sayHi':
						resultText = 'Chào bạn. ;)';
						fb.sendTextMessage(senderId, resultText);
						break;
					case 'accountInquiry':
						resultText = 'Quý khách muốn xem tài khoản, ok.';
						fb.sendTextMessage(senderId, resultText);
						tradeApi.displayAccount('0001032425').then(function(data) {
							fb.sendTextMessage(senderId, data[0]);
							for (let stockInfoDataTextItem of data[1]) {
								fb.sendTextMessage(senderId, stockInfoDataTextItem);
							}
						});
						break;
					default:
						resultText = 'Xin lỗi, tôi hiểu yêu cầu của bạn, nhưng tôi không biết phải làm gì.';
						fb.sendTextMessage(senderId, resultText);
				}
			}
		});
	});
	res.sendStatus(200);
});

app.listen(PORT, function() {
	console.log('Listening on port ' + PORT);
});