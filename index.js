var parser = require('cron-parser');
var request = require('request');
var fs = require('fs');
var moment = require('moment');

var loopSeconds = 60;
var configFile = 'config.json';

var argv = require('minimist')(process.argv.slice(2));
if (argv.c) {
  configFile = argv.c;
}
if (argv.tickLength || argv.t) {
  loopSeconds = argv.t;
}

var Job = function (conf) {
  this.title = conf.title;
  this.cron = conf.cron;
  this.uri = conf.uri;
  this.domains = conf.domains;
  this.protocol = conf.protocol;

  // Determine from protocol, uri, domains
  this.urls = [];
  if (this.uri) {
    this.url = this.protocol + '://' + this.domains[0] + this.uri;
    for(i=0; i<this.domains.length; i++) {
      this.urls.push(this.protocol + '://' + this.domains[i] + this.uri);
    }
  } else {
    this.url = conf.url;
  }

  this.guru = "https://crontab.guru/#" + this.cron.replace(' ', '_');
  this.interval = parser.parseExpression(this.cron);
  this.lastStatus = 'N/A';
};

Job.prototype.next = function () {
  this._next = this.interval.next();
  this.nextRun = this._next._date.format('LLLL');
};

Job.prototype.run = function() {
  var that = this;
  if (this.uri && this.urls.length) {
    // Multiple domains
    for(var i=0; i<this.urls.length; i++) {
      request.get(this.urls[i], function (error, response, body) {
        that.statusCode = response.statusCode;
        that.lastStatus = response.statusMessage;
        that.body = body;
        // TODO: Record status code, body, request time, string check
      });
    }
  } else {
    request.get(this.url, function (error, response, body) {
      that.statusCode = response.statusCode;
      that.lastStatus = response.statusMessage;
      that.body = body;
      // TODO: Record status code, body, request time, string check
    });
  }

};

console.log("Reading groups/jobs from" + configFile);
var groups = JSON.parse(fs.readFileSync(configFile, 'utf8'));
groups.forEach(function(group) {
  for (var i=0; i<group.jobs.length; i++) {
    var job = new Job(group.jobs[i]);
    job.next();
    group.jobs[i] = job;
  }
});

// Setup HTTP server and sockets.  We only serve one page
var server = require('http').createServer(function(req, res) {
  res.end(fs.readFileSync('index.html', 'utf8'));
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  // Will validate the connection
  socket.on('register', function(data) {
    socket.emit('groups', groups);
    io.emit('tick', {serverTime: moment().format('LLLL')});
  });
});

server.listen(3000);

// Start timing loop. Each job will be checked on every loop to determine if it's time to run
console.log("Setting up timer for " + loopSeconds + " seconds");
setInterval(function() {
  var now = moment();

  io.emit('tick', {serverTime: now.format('LLLL')});

  for (var g=0; g<groups.length; g++) {
    var group = groups[g];
    for (var i=0; i<group.jobs.length; i++) {
      var job = group.jobs[i];
      if (job.done) continue;

      // TODO: Correct way to get moment object from CronDate?
      if (now.isSameOrAfter(job._next._date, 'minute')) {
        job.run();
        job.next();
      }
    }
  }
}, loopSeconds * 1000);




