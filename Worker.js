var format = require("stringformat");
var config = require("config");
var amqp = require("amqp");
var logger = require("dvp-common/LogHandler/CommonLogHandler.js").logger;

//var queueHost = format('amqp://{0}:{1}@{2}:{3}', config.RabbitMQ.user, config.RabbitMQ.password, config.RabbitMQ.ip, config.RabbitMQ.port);

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

queueConnection.on("ready", function() {
  logger.info("Conection with the queue is OK");
});

queueConnection.on("error", function(error) {
  logger.info("There is an error " + error);
});

module.exports.PublishToQueue = function(messageType, sendObj) {
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
