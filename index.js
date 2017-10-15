var parser = require('cron-parser');
var request = require('request');

function doRequest(url) {
  request.get(url, function (error, response, body) {
    console.log(url);
  });
}

var url = "http://www.fivetechnology.com";
doRequest(url);
url = "http://www.smumn.edu";
doRequest(url);

try {
  var interval = parser.parseExpression('*/2 * * * *');

  console.log('Date: ', interval.next().toString()); // Sat Dec 29 2012 00:42:00 GMT+0200 (EET)
  console.log('Date: ', interval.next().toString()); // Sat Dec 29 2012 00:44:00 GMT+0200 (EET)

  console.log('Date: ', interval.prev().toString()); // Sat Dec 29 2012 00:42:00 GMT+0200 (EET)
  console.log('Date: ', interval.prev().toString()); // Sat Dec 29 2012 00:40:00 GMT+0200 (EET)
} catch (err) {
  console.log('Error: ' + err.message);
}

//

var options = {
  currentDate: new Date('Wed, 26 Dec 2012 12:38:53 UTC'),
  endDate: new Date('Wed, 26 Dec 2012 14:40:00 UTC'),
  iterator: true
};

try {
  var interval = parser.parseExpression('*/22 * * * *', options);

  while (true) {
    try {
      var obj = interval.next();
      console.log('value:', obj.value.toString(), 'done:', obj.done);
    } catch (e) {
      break;
    }
  }

  // value: Wed Dec 26 2012 14:44:00 GMT+0200 (EET) done: false
  // value: Wed Dec 26 2012 15:00:00 GMT+0200 (EET) done: false
  // value: Wed Dec 26 2012 15:22:00 GMT+0200 (EET) done: false
  // value: Wed Dec 26 2012 15:44:00 GMT+0200 (EET) done: false
  // value: Wed Dec 26 2012 16:00:00 GMT+0200 (EET) done: false
  // value: Wed Dec 26 2012 16:22:00 GMT+0200 (EET) done: true
} catch (err) {
  console.log('Error: ' + err.message);
}

//

var options = {
  currentDate: '2016-03-27 00:00:01',
  tz: 'Europe/Athens'
};

try {
  var interval = parser.parseExpression('0 * * * *', options);

  console.log('Date: ', interval.next().toString()); // Date:  Sun Mar 27 2016 01:00:00 GMT+0200
  console.log('Date: ', interval.next().toString()); // Date:  Sun Mar 27 2016 02:00:00 GMT+0200
  console.log('Date: ', interval.next().toString()); // Date:  Sun Mar 27 2016 04:00:00 GMT+0300 (Notice DST transition)
} catch (err) {
  console.log('Error: ' + err.message);
}