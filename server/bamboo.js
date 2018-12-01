/*
Available employee fields (from Bamboo):
 id: '12345'
 displayName: 'Doe, Jane'
 firstName: 'Jane'
 lastName: 'Doe'
 preferredName: null
 gender: 'Female'
 jobTitle: 'Senior Programmer'
 workPhone: null
 mobilePhone: '404-123-4567'
 workEmail: 'jane.doe@work.com'
 department: 'Technology'
 location: 'Skunkworks'
 division: 'ABC'
 workPhoneExtension: null
 photoUploaded: true
 photoUrl: 'https://s3.ca-central-1.amazonaws.com/bamboohr-app-ca-central-1-production/images/1234/photos/12345-2-1.jpg'
 canUploadPhoto: 0
*/

const https = require('https');

class Bamboo
{
    constructor(config)
    {
        this.organization = config.organization;
        this.apikey = config.apikey;
        this.directory = null;
    }
    
    getDirectory()
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
                bamboo.directory = JSON.parse(body)['employees'];
                console.log("retrieved " + bamboo.directory.length + " employee records");
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
