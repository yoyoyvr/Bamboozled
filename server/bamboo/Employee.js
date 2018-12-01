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
    
    get photoUrl()
    {
        return this._data.photoUrl;
    }
    
    get fullName()
    {
        return this.hasPreferredName ? (this._data.preferredName + " " + this._data.lastName) : (this._data.firstName + " " + this._data.lastName);
    }
    
    get hasPreferredName()
    {
        return (this._data.preferredName != null) && (this._data.preferredName != '');
    }
    
    nameMatches(name)
    {
        var upperName = name.toUpperCase();
        var matches =
            (upperName == this._data.firstName.toUpperCase()) ||
            (this.hasPreferredName && (upperName == this._data.preferredName.toUpperCase())) ||
            (upperName == this._data.lastName.toUpperCase());
        return matches;
    }
}

module.exports = Employee;
