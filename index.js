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

console.log("Reading configuration from " + configFile);
var config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// Setup HTTP server and sockets.  We only serve one page
var server = require('http').createServer(function(req, res) {
  res.end(fs.readFileSync('index.html', 'utf8'));
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  // Will validate the connection
  socket.on('register', function(data) {
    socket.emit('groups', config.groups);
    socket.emit('tick', {serverTime: moment().format('LLLL')});
  });
});

var Job = function (conf) {
  this.title = conf.title;
  this.cron = conf.cron;
  this.uri = conf.uri;
  this.url = conf.url;
  this.done = conf.done;
  this.domain = '';
  this.domains = conf.domains;
  this.protocol = conf.protocol;
  this.string = conf.string;
  this.runOnStart = conf.runOnStart;
};

Job.prototype.next = function () {
  this._next = this.interval.next();
  this.done = this._next.done;
  this.nextRun = this._next._date.format('LLLL');
};

Job.prototype.init = function() {
  if (this.uri) {
    this.url = this.protocol + '://' + this.domain + this.uri;
  }
  console.log('Initializing ' + this.url);
  this.guru = "https://crontab.guru/#" + this.cron.replace(' ', '_');
  this.interval = parser.parseExpression(this.cron);
  this.lastStatus = 'N/A';
  this.statusCode = 0;

  this.next();
  if (!config.disabled && this.runOnStart) {
    this.run();
  }
};

Job.prototype.request = function(url) {
  var that = this;
  request.get({url: url, timeout: config.defaultTimeout * 1000}, function (error, response, body) {
    if (response) {
      that.statusCode = response.statusCode;
      that.lastStatus = response.statusMessage;
      that.body = body;
      if (that.string) {
        console.log('Searching for ' + that.string);
        if (body.search(that.string) === -1) {
          that.statusCode = 206;
          that.lastStatus = "String " + that.string + " not found";
        }
      }
      if (config.slackhook && that.statusCode != 200) {
        console.log("Sending Slack notification");
        slack.webhook({
          channel: config.slackChannel,
          // Not sending the URL as Slack may "unfurl" it essentially running the job again
          text: that.group + ": " + that.title + ": " + that.statusCode + ": " + that.lastStatus
        }, function(err, response) {
          //console.log(response);
        });
      }
    } else {
      console.log(error);
    }
    io.emit('job', that);
  });
};

Job.prototype.run = function() {
  this.request(this.url);
};


// Setup Slack webhook if URL is defined in configuration.  Uses #HRS channel
if (config.slackhook) {
  console.log("Setting up slack webhook");
  var Slack = require('slack-node');
  slack = new Slack();
  slack.setWebhook(config.slackhook);
}

config.groups.forEach(function(group) {
  var jobCount = group.jobs.length;
  for (var i=0; i<jobCount; i++) {
    var job = new Job(group.jobs[i]);
    job.group = group.title;

    // Treat multiple domains as separate job
    if (job.uri && job.domains.length) {
      // Multiple domains
      job.domain = job.domains[0];
      job.init();
      group.jobs[i] = job;

      for (var d=1; d<job.domains.length; d++) {
        var jobm = new Job(group.jobs[i]);
        jobm.domain = jobm.domains[d];
        jobm.init();
        group.jobs.push(jobm);
      }
    } else {
      job.init();
      group.jobs[i] = job;
    }

  }
});


server.listen(config.port);

// Start timing loop. Each job will be checked on every loop to determine if it's time to run
if (argv.t) {
  loopSeconds = argv.t;
}
console.log("Setting up timer for " + loopSeconds + " seconds");

setInterval(function() {
  var now = moment();

  io.emit('tick', {serverTime: now.format('LLLL')});

  for (var g=0; g<config.groups.length; g++) {
    var group = config.groups[g];
    for (var i=0; i<group.jobs.length; i++) {
      var job = group.jobs[i];
      if (job.done) continue;

      // TODO: Correct way to get moment object from CronDate?
      if (now.isSameOrAfter(job._next._date, 'minute')) {
        if (! config.disabled) {
          job.run();
        }
        // TODO: Should job continue to run on error?
        job.next();
      }
    }
  }
}, loopSeconds * 1000);




