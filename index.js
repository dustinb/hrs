var parser = require('cron-parser');
var request = require('request');
var fs = require('fs');
var moment = require('moment');
var loopSeconds = 15;
var jobs = [];

var Job = function (conf) {
  this.cron = conf.cron;
  this.uri = conf.uri;
  // Determine from protocol, uri, domains or set
  this.url = conf.url;
  this.protocol = conf.protocol;
  this.domains = conf.domains;
  this.interval = parser.parseExpression(this.cron);
};

Job.prototype.next = function () {
  this._next = this.interval.next();
  this.nextRun = this._next._date.format('LLLL');
};

Job.prototype.run = function() {
  var that = this;
  request.get(this.url, function (error, response, body) {
    console.log(that.url);
    that.statusCode = response.statusCode;
    that.statusMessage = response.statusMessage;
    that.body = body;
    // TODO: Record status code, body, request time, string chech
  });
};

console.log("Reading jobs from config.json");
var conf = JSON.parse(fs.readFileSync('config.json', 'utf8'));
conf.forEach(function(jobData) {
    var job = new Job(jobData);
    job.next();
    jobs.push(job);
});

// Setup sockets for reporting
var server = require('http').createServer(function(req, res) {
  console.log('http request');
  res.end(fs.readFileSync('index.html', 'utf8'));
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  socket.valid = true;

  // Will validate the connection
  socket.on('register', function(data) {
    console.log('Register');
    socket.emit('jobs', jobs);
  });
});

server.listen(3000);

// Start timing loop. Each job will be checked on every loop to determine if it's time to run
console.log("Setting up timer for " + loopSeconds + " seconds");
setInterval(function() {
  var now = moment();

  for(var i=0; i<jobs.length; i++) {
    var job = jobs[i];

    if (job.done) continue;

    // TODO: How to get the moment from CronDate
    if (now.isSameOrAfter(job._next._date, 'minute')) {
      io.emit('message', now.toString() + ' > ' + job._next.toString());
      job.run();
      job.next();
    } else {
      io.emit('message', job.url + " won't run until " + job._next.toString());
    }
  }
}, loopSeconds * 1000);







