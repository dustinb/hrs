# HTTP Request Scheduler

Schedules HTTP(S) requests using crontab format and reports on the status.

# Features

1. Group jobs into meaningful groups like application or client
2. Allow running jobs on multiple domains i.e. development/production
3. Record response for all instances: status, code, body
4. String match to identify success/failure
5. Allow "waterfall" or running a list of jobs in sequence
6. 

# Setup

1. `git clone git@github.com:dustinb/hrs.git`
2. `cd hrs`
3. `npm install`
4. `node hrs start`
5. Browse to http://localhost:3000

Use `node hrs stop` to stop HRS.  To reload new/updated configuration `node hrs reload`.

To start HRS with alternate config `node hrs start -c simple.json`

# Configuration

A job requires `title`, `cron`, and a `url`.
 
 | Optional     | Description                                                     |
 | -------------| ----------------------------------------------------------------|
 | `string`     | Look for this string in response. If not found treat as failure |
 | `runOnStart` | HRS will run this job on startup (and reload)                   |
 | `done`       | Set to true if you want to disable this job                     |

```
    {
      "title": "Five Tech Team",
      "cron": "*/5 * * * * ",
      "url": "http://www.fivetechteam.com",
      "string": "Call us @",
      "runOnStart": false,
      "done": false
    }
```
    
## Multiple Domains

If wanting to run the same job on multiple domains include `protocol` and `domains`.

```
{
  "title": "Multiple Domains",
  "cron": "*/5 * * * * ",
  "url": "/res/job/cleanhouse.php",
  "protocol": "http",
  "domains": [
     "dev.example.com",
     "staging.example.com",
     "production.example.com"
  ]
}
```
  
## Waterfall

Run jobs in sequence by putting the cron in the group instead of the job.  The cron specifies
a start time for the first job, second one runs after first completes and so on.

```
{
  "title": "Waterfall Group",
  "cron": "10 2 * * * ",
  "jobs": [
    {
      "title": "Job 1",
      "url": "http://hrs.fivetechdev.com/timestamp.php"
    },
    {
      "title": "Job 2",
      "url": "http://hrs.fivetechdev.com/timestamp.php?uniqueurl=1"
    }
  ]
}
```       

# Slack Webhook

Add your Slack webhook url to the configuration to allow HRS to send error notifications

```json
{
  "slackhook": "https://hooks.slack.com/services/xxxxxxxxx/xxxxxxxxx/xxxxxxxxxxxxxxxxxxxxxxxx",
  "slackChannel": "#HRS",
  "groups": [ 
    {
      "title": "Group 1",
      "jobs": [
        {
          "title": "Job 1",
          "cron": "30 2 * * * ",
          "url": "http://www.example.com/",
          "runOnStart": true
        }
      ]
    }
  ]
}
```

![](hrs.png)

# Inspiration + Research
https://github.com/harrisiirak/cron-parser \
https://crontab.guru/ \
https://momentjs.com/docs/ \
https://github.com/request/request \
https://www.npmjs.com/package/slack-node \
https://socket.io/ \
https://vuejs.org/ \
https://v4-alpha.getbootstrap.com/ \
https://github.com/substack/minimist \


https://github.com/fzaninotto/uptime \
http://www.camintejs.com/en \
https://github.com/iloire/watchmen

