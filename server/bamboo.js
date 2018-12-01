const https = require('https');

class Bamboo
{
    constructor(config)
    {
        this.organization = config.organization;
        this.apikey = config.apikey;
        this.employeeDirectory = null;
    }
    
    getEmployeeDirectory()
    {
        var bamboo = this;  // save for use in callback, since closure on 'this' doesn't do what we need
        
        var options = {
          host: 'api.bamboohr.com',
          method: 'GET',
          path: '/api/gateway.php/' + this.organization + '/v1/employees/directory',
          auth: this.apikey + ':x',
          headers: {Accept: 'application/json'}
        };
        var req = https.request(
            options,
            function (response)
            {
              response.setEncoding('utf8');
              var body = "";
              response.on('data', function (chunk)
              {
                  body += chunk;
              }).on('end', function()
              {
                bamboo.employeeDirectory = JSON.parse(body)['employees'];
                console.log("retrieved " + bamboo.employeeDirectory.length + " employee records");
              });
              response.on('error', console.error);
            }
        ).end();
    }
}

class EmployeeRecord
{
    constructor(name)
    {
        this.name = name;
    }
    
    greet()
    {
        console.log("Hello " + this.name);
    }
}

module.exports =
{
    Bamboo: Bamboo,
    EmployeeRecord: EmployeeRecord
}
