if (Meteor.isClient) {
  Template.hello.greeting = function () {
    return "Welcome to bitcoin-stream.";
  };

  Template.hello.events({
    'click input': function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
        console.log("You pressed the button");
    }
  });
}

if (Meteor.isServer) {

  // anx restful API for obtaining datatoken 
  // the restful api also supports many functions such as trading and send money - see github.com/btcdude/anx and http://docs.anxv2.apiary.io/
  var ANX = Meteor.require('anx');

  //obtain key and secret by creating an account at anxpro.com
  var key = '45a66603-523b-4f2d-bf45-79654766f578';
  var secret = 'HvNa6MLS515PdgCfWH6Waj1cLqpoKH2aL0DwoIX2+0pEEao8CQQshxZydmSm38xMgXQjIcNkggHsBFWRy8681w==';

  // connect to ANX
  // it is possible to override the environment for testing (ANX provides sandbox environments to some partners) (ignore if you are testing against ANX production)
  //var host = 'https://anxpro.com'  // http://my-partner-sandbox.anxpro.com
  var host = 'https://anxpro.com';
  var rest_client = new ANX(key, secret, "BTCUSD", host);

  // socket.io for streaming support
  var io = Meteor.require('socket.io-client');

  // obtain data key and uuid for private subscriptions
  wrappedConnect = Meteor.bindEnvironment(function (err, json) {
      if (err) {
          throw JSON.stringify(err,null,3);
      }

      var token = json.token;
      var uuid = json.uuid;

      console.log("Collected deets", token, uuid);

      // use token to get streaming connection
      var server = io.connect(host, {resource: 'streaming/2'});

      server.on('connect', function () {
          console.log("connected");

          // on each connect, subscribe to the relevant topics, passing your token
          server.emit('subscribe', {token: token, topics: ['public/tick/ANX/BTCUSD', 'public/orderBook/ANX/BTCUSD', 'public/trades/ANX/BTCUSD', 'private/' + uuid]});

          // you could have multiple tokens (for different users/api keys) and subscribe for private data within this single socket.io connection
          //server.emit('subscribe',{token:another_token,topics:['private/'+another_uuid]});
      });

      // note we send the "subscribe" requests each time on connect, however we set the local "on" handlers only once.
      server.on('reconnect_failed', function() {
          console.log("reconnect failed, now disconnected without reconnect.");
      });

      server.on('connect_error',function(err) {
          console.log("Connection error:", JSON.stringify(err,null,2));
      });

      // PUBLIC DATA

      // tick events
      server.on('public/tick/ANX/BTCUSD', function (data) {
          console.log("tick received:" + JSON.stringify(data, undefined, 2));
      });

      // order book updates for high quality pricing  (single atomic json message for lengthy top of book)
      server.on('public/orderBook/ANX/BTCUSD', function (data) {
          console.log("orderbook update" + JSON.stringify(data, undefined, 3));
      });

      // public trade data (i.e. receive a notification for every trade that is executed
      server.on('public/trades/ANX/BTCUSD', function (data) {
          console.log("trade event:" + JSON.stringify(data, undefined, 2));
      });

      // PRIVATE DATA

      // subscribe to private events - fills, order updates, and account balance updates (check the eventType field on the received message)
      server.on('private/' + uuid, function (data) {
          console.log("private event received:" + JSON.stringify(data, undefined, 2));
      });

  });

  rest_client.dataToken(wrappedConnect);

}
