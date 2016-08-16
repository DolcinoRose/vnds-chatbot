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

const messageGapTime = 200;

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
	// req.body.entry.forEach(function(pageEntry) {
	// 	pageEntry.messaging.forEach(function(messaging) {
	// 		console.log(messaging);
	// 	});
	// });
	fb.processRequest(req, function(message, senderId) { // we got a real message from user

		fb.pretendTyping(senderId); // pretend that the bot is typing...

		fb.findOrCreateUserSessionInfo(senderId).then(function(user) { // get user session info, including his facebook's profile

			bot.witProcessor(message, senderId).then(function(entities) {
				var intent = entities.intent ? entities.intent[0] : undefined;

				console.log(entities);

				if (!intent) {
					if (entities.symbol) { // not sure what the user's intent is, but they mentioned a symbol, so let's respond with some stock info anyway
						bot.processStockInfo(entities.symbol).then(function(stockInfoData){
							fb.sendButtonMessage(senderId, stockInfoData.resultText, stockInfoData.actionButtons);
						});
					} else {
						fb.sendTextMessage(senderId, `Xin lỗi ${user.pronounce} ${user.fbProfile.first_name}, em chưa hiểu yêu cầu của ${user.pronounce}.`);
					}
				} else {
					switch(intent.value) {
						case 'stockInfo':
							if (entities.symbol) {
								bot.processStockInfo(entities.symbol).then(function(stockInfoData){
									fb.sendButtonMessage(senderId, stockInfoData.resultText, stockInfoData.actionButtons);
								});
							} else {
								fb.sendTextMessage(senderId, `Xin lỗi ${user.pronounce} ${user.fbProfile.first_name}, em không tìm thấy mã chứng khoán này.`);
							}
							break;

						case 'accountInquiry':
							fb.sendTextMessage(senderId, `Dạ, ${user.pronounce} muốn xem danh mục đầu tư ạ, ${user.pronounce} vui lòng đợi em một lát ạ...`);
							fb.pretendTyping(senderId);
							tradeApi.displayAccount('0001032425').then(function(data) {
								setTimeout(function() {
									fb.sendTextMessage(senderId, data[0]);
								}, messageGapTime);
								var count = 0;
								for (let stockInfoDataTextItem of data[1]) {
									count++;
									// send facebook messages for stock info in order
									setTimeout(function() {
										fb.sendTextMessage(senderId, stockInfoDataTextItem);
									}, count*messageGapTime);
								}
							});
							break;

						case 'sayHi':
							fb.sendTextMessage(senderId, `Chào ${user.pronounce} ${user.fbProfile.first_name} ạ! 😄`);
							break;

						case 'marketAdvice':
							var side;
							if (entities.side) {
								if (entities.side[0].value == 'buy') {
									side = 'mua';
								} else if (entities.side[0].value == 'sell') {
									side = 'bán';
								}
								if (Math.random() < 0.5) {
									fb.sendTextMessage(senderId, `Có lẽ không nên ${side} mã ${entities.symbol[0].value} lúc này ${user.pronounce} ạ 🙈`);
								} else {
									fb.sendTextMessage(senderId, `Chuẩn, nên ${side} con ${entities.symbol[0].value} sớm ${user.pronounce} ạ! 👍`);
								}
							} else {
								fb.sendTextMessage(senderId, `Với mã ${entities.symbol[0].value}, em nghĩ ${user.pronounce} nên tin vào trực giác của mình.`);
							}
							break;

						default:
							fb.sendTextMessage(senderId, `Xin lỗi, em hiểu yêu cầu của ${user.pronounce}, nhưng em không biết phải làm gì.`);
					}
				}
			}).catch(function() {
				fb.sendTextMessage(senderId, `Em chưa hiểu ý ${user.pronounce} ${user.fbProfile.first_name}, ${user.pronounce} có thể nói rõ hơn được không ạ?`);
			});

		});
	});
	res.sendStatus(200);
});

app.listen(PORT, function() {
	console.log('Listening on port ' + PORT);
});