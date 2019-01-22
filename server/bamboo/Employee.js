const normalizer = require('./normalizer');

class Employee
{
    constructor(data)
    {
        this._data = data;
    }
    
    /*
    Available employee fields (from BambooHR API):
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

    get id()
    {
        return this._data.id;
    }
    
    get email()
    {
        return this._data.workEmail;
    }
    
    get photoUrl()
    {
        return this._data.photoUrl;
    }

    get fullName()
    {
        return (this._data.firstName + " " + this._data.lastName);
    }
    
    get fullPreferredName()
    {
        return ((this.hasPreferredName ? this._data.preferredName : this._data.firstName) + " " + this._data.lastName);
    }
    
    get hasPreferredName()
    {
        return (this._data.preferredName != null) && (this._data.preferredName != '');
    }
    
    // Partial name match:
    // - name is split on spaces, each part must match
    // - can match first name, last name, or preferred name
    // - matching is done in lower case with accents stripped
    nameMatches(name)
    {
        var matches = false;
        var guess = normalizer.normalize(name);
        var guessparts = guess.split(" ");
        if (guessparts.length > 0)
        {
            var allnames = normalizer.normalize(this._data.firstName) + " " + normalizer.normalize(this._data.lastName);
            if (this.hasPreferredName)
            {
                allnames = allnames + " " + normalizer.normalize(this._data.preferredName);
            }
            var nameparts = allnames.split(" ");
            matches = true;
            for (var i = 0; i < guessparts.length; ++i)
            {
                var guesspart = guessparts[i];
                var partmatches = false;
                for (var j = 0; j < nameparts.length; ++j)
                {
                    var namepart = nameparts[j];
                    partmatches = partmatches || (guesspart == namepart);
                }
                
                matches = matches && partmatches;
            }
        }
        return matches;
    }
    
    // Full name match:
    // - name must match "firstname lastname" (preferred name is ignored)
    // - matching is done in lower case with accents stripped
    fullNameMatches(name)
    {
        var guess = normalizer.normalize(name);
        var fullname = normalizer.normalize(this._data.firstName) + " " + normalizer.normalize(this._data.lastName);
        return (guess == fullname);
    }
    
    toString()
    {
        return JSON.stringify(this);
    }
}

module.exports = Employee;
