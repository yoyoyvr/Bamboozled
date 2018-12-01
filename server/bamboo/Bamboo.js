const https = require('https');
const Employee = require('./Employee');

class Bamboo
{
    constructor(config)
    {
        this.organization = config.organization;
        this.apikey = config.apikey;
        this.directory = null;
        
        this._getDirectory();
    }
    
    findEmployee(id)
    {
        return this.directory[id];
    }
    
    getRandomEmployee()
    {
        var r = Math.floor(Math.random() * this.directory._data.length);
        var id = this.directory._data[r].id;
        var employee = this.directory[id];
        return employee;
    }

    _getDirectory()
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
                bamboo.directory = Bamboo._createDirectory(JSON.parse(body)['employees']);
                console.log("retrieved " + bamboo.directory._data.length + " employee records");
              });
              response.on('error', console.error);
            }
        ).end();
    }
    
    static _createDirectory(data)
    {
        var directory = {};
        for (var i = 0; i < data.length; i++)
        {
            var employee = new Employee(data[i]);
            directory[employee.id] = employee;
        }
        
        directory._data = data;
        
        return directory;
    }
}

module.exports = Bamboo;
