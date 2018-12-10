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
    
    getEmployee(id)
    {
        return this.directory[id];
    }
    
    findEmployeeByEmail(email)
    {
        for (var id in this.directory)
        {
            var employee = this.directory[id];
            if (employee.email == email)
            {
                return employee;
            }
        }
    }
    
    getEmployeeIDs()
    {
        return Object.keys(this.directory);
    }
    
    getRandomEmployeeIDs(count)
    {
        var ids = Bamboo._shuffle(this.getEmployeeIDs());
        if (count)
        {
            ids = ids.slice(0, count);
        }
        return ids;
    }
    
    getRandomEmployee()
    {
        var r = Math.floor(Math.random() * this._directoryData.length);
        var id = this._directoryData[r].id;
        var employee = this.directory[id];
        return employee;
    }

    // From https://stackoverflow.com/a/6274381/503688
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
    static _shuffle(a)
    {
        var j, x, i;
        for (i = a.length - 1; i > 0; i--)
        {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
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
                // TODO: should add error handling (and cache the directory data)
                bamboo._directoryData = JSON.parse(body)['employees'];
                bamboo.directory = Bamboo._createDirectory(bamboo._directoryData);
                console.log("retrieved " + bamboo._directoryData.length + " employee records");
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
        
        return directory;
    }
}

module.exports = Bamboo;
