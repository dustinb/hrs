// TODO: https://github.com/niegowski/node-daemonize2
// TODO: NoSql Persistence?
// TODO: Move Job into module

var parser = require('cron-parser');
var fs = require('fs');
var moment = require('moment');
var async = require('async');
var Job = require('./Job.js');
var Slack = require('slack-node');
let YAML = require('yamljs');

var config = {
  configFile: 'config',
  port: 3000
};

if (process.argv[3]) {
  config.configFile = process.argv[3];
}

// Setup HTTP server and sockets.  We only serve one page
var server = require('http').createServer(function(req, res) {
  res.end(fs.readFileSync('index.html', 'utf8'));
});

var io = require('socket.io')(server);

io.on('connection', function(socket) {
  // Will validate the connection
  socket.on('register', function(data) {
    socket.emit('groups', config.Groups);
    socket.emit('tick', {serverTime: moment().format('LLLL')});
  });
});

process.on('SIGHUP', function() {
  console.log('Received SIGHUP');
  readConfiguration();
});

function readConfiguration() {
  // TODO: Catch exception
  config = YAML.load(config.configFile);

  config.Groups = [];

  if (config.configDirectory) {
    let filenames = fs.readdirSync(config.configDirectory);
    filenames.forEach(function(filename) {
      console.log(filename);
      // TODO: Catch exception
      let group = YAML.load(config.configDirectory + '/' + filename);
      groupSetup(group);
    });
  } else {
    config.groups.forEach(function (group) {
      groupSetup(group);
    });
  }
  delete config.groups;

}

/**
 * Upon reading the configuration setup the group and job objects. Will only process the object/data if the group's
 * hash does not match an existing one.  This allows SIGHUP to only change updated or new group/job data.
 */
function groupSetup(group) {

  group.Jobs = [];

  group.jobs.forEach(function(jobConfig) {
    console.log('configure' + jobConfig.title);
    let job = new Job(jobConfig);

    if (typeof job.timeout === 'undefined') {
      job.timeout = config.defaultTimeout;
    }
    job.group = group.title;
    job.disabled = job.disabled || config.disabled;

    // Treat multiple domains as separate job
    if (job.protocol && job.domains.length) {
      // Multiple domains
      job.domain = job.domains[0];
      group.Jobs.push(job);
      job.domains.forEach(function(domain) {
        let jobm = new Job(jobConfig);
        jobm.setURL(jobConfig.protocol + '://' + domain + jobConfig.url);
      })
    } else {
      group.Jobs.push(job);
      if (job.runOnStart) {
        job.run(checkStatus);
      }
    }
  });
  delete group.jobs;

  if (group.cron) {
    group.interval = parser.parseExpression(group.cron);
    group.next = function () {
      this._next = this.interval.next();
      this.done = this._next.done;
      this.nextRun = this._next._date.format('LLLL');
      this.Jobs[0].nextRun = this.nextRun;
    };
    group.next();
  }

  config.Groups.push(group);
  //io.emit('groups', config.Groups);
}

readConfiguration();

server.listen(config.port);

setInterval(function() {
  let now = moment();

  io.emit('tick', {serverTime: now.format('LLLL')});

  config.Groups.forEach(function (group) {

    // If the group itself has a cron entry we'll run each job in the group in sequence.
    if (group.cron) {
      if (now.isSameOrAfter(group._next._date, 'minute')) {
        group.next();
        async.eachSeries(group.Jobs, function(job, callback) {
          // Need to send this callback to job.request() so we can start the next one
          job.run(checkStatus, callback);
        });
      }
    } else {
      group.Jobs.forEach(function(job) {
        // job.done is set when the cron iteration finishes or disabled set to false in configuration
        if (job.done) return;

        // Not sure if proper way to get moment object, using _private property here
        if (now.isSameOrAfter(job._next._date, 'minute')) {
          job.next();
          job.run(checkStatus);
        }
      });
    }
  });
}, 60 * 1000);


// Setup Slack webhook if URL is defined in configuration.  Uses #HRS channel
if (config.slackhook) {
  console.log("Setting up slack webhook");
  slack = new Slack();
  slack.setWebhook(config.slackhook);
}

function checkStatus() {
  io.emit('job', this);
  if (config.slackhook && this.statusCode != 200) {
    slack.webhook({
      channel: config.slackChannel,
      // Not sending the URL as Slack may "unfurl" it essentially running the job again
      text: this.group + ": " + this.title + ": " + this.statusCode + ": " + this.lastStatus
    }, function(err, response) {
      //console.log(response);
    });
  }
}

