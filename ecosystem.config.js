module.exports = {
    apps : [{
      name   : "grizzy main",
      script : "./app.js",
      time   : true

    },{
      name   : "grizzy deployment consumer",
      script : "./queues/consumer.js",
      time   : true
    }]
}