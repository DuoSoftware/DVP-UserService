var format = require("stringformat");
var config = require("config");
var amqp = require("amqp");
var logger = require("dvp-common/LogHandler/CommonLogHandler.js").logger;

//var queueHost = format('amqp://{0}:{1}@{2}:{3}', config.RabbitMQ.user, config.RabbitMQ.password, config.RabbitMQ.ip, config.RabbitMQ.port);

let readyCount = 0;
var amqpIPs = [];
if (config.RabbitMQ.ip) {
  amqpIPs = config.RabbitMQ.ip.split(",");
}

var queueConnection = amqp.createConnection(
  {
    host: amqpIPs,
    port: config.RabbitMQ.port,
    login: config.RabbitMQ.user,
    password: config.RabbitMQ.password,
    vhost: config.RabbitMQ.vhost,
    noDelay: true,
    heartbeat: 10
  },
  {
    reconnect: true,
    reconnectBackoffStrategy: "linear",
    reconnectExponentialLimit: 120000,
    reconnectBackoffTime: 1000
  }
);

queueConnection.on("heartbeat", function() {
  logger.debug("RabbitMQ HeartBeat");
});

queueConnection.on("ready", function() {
  logger.info("Conection with the queue is OK");
  readyCount += 1;
  if (readyCount === 1)
    queueConnection.queue(
      "TEST",
      { durable: true, autoDelete: false, closeChannelOnUnsubscrib: true },
      function(q) {
        q.bind("#");
        q.subscribe(function(message) {
          logger.info(`Message Consumed ${JSON.stringify(message)}`);
        });
      }
    );
});

queueConnection.on("error", function(error) {
  logger.info("There is an error " + error);
});

let PublishToQueue = function(messageType, sendObj) {
  logger.info(
    "From: " + sendObj.from + " To: " + sendObj.to + " Queue :" + messageType
  );

  try {
    if (sendObj) {
      queueConnection.publish(messageType, sendObj, {
        contentType: "application/json"
      });
    }
  } catch (exp) {
    console.log(exp);
  }
};

module.exports.PublishToQueue = PublishToQueue;
