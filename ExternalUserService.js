/**
 * Created by a on 6/26/2016.
 */
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var ExternalUser = require('dvp-mongomodels/model/ExternalUser');
var ExternalUserAccessFields = require('dvp-mongomodels/model/ExternalUserAccessConfig').ExternalUserAccessFields;
var AccessSchema = require('dvp-mongomodels/model/ExternalUserAccessConfig').AccessSchema;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var regex = require('regex');
var FormSubmission = require('dvp-mongomodels/model/FormMaster').FormSubmission;
var config = require('config');
var util = require('util');


function GetExternalUsers(req, res) {


    logger.debug("DVP-UserService.GetExternalUsers Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    ExternalUser.find({company: company, tenant: tenant}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External Users Failed", false, undefined);

        } else {

            if (users) {


                jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External Users Found", false, undefined);

            }
        }

        res.end(jsonString);
    });

}

function GetExternalUser(req, res) {


    logger.debug("DVP-UserService.GetExternalUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    ExternalUser.findOne({_id: req.params.id, company: company, tenant: tenant}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External User Failed", false, undefined);

        } else {

            if (users) {

                jsonString = messageFormatter.FormatMessage(err, "Get External User Successful", true, users);


            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No external user found", false, undefined);
            }
        }

        res.end(jsonString);
    });

}


function GetExternalUserAttribute(req, res) {


    logger.debug("DVP-UserService.GetExternalUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    ExternalUser.findOne({_id: req.params.id, company: company, tenant: tenant}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External User Failed", false, undefined);

        } else {

            if (users) {
                if (req.params.attribute && req.params.attribute && users[req.params.attribute]) {
                    var userObj;
                    jsonString = messageFormatter.FormatMessage(err, "Get External User Successful", true, users[req.params.attribute]);
                } else {
                    jsonString = messageFormatter.FormatMessage(err, "Get External User Successful but no attribute found", true, undefined);
                }

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No external user found", false, undefined);
            }
        }

        res.end(jsonString);
    });

}

function UpdateExternalUserAttribute(req, res) {


    logger.debug("DVP-UserService.UpdateExternalUserAttribute Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    var updateObject = {};
    updateObject[req.params.attribute] = req.params.value;

    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, updateObject, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update External User Failed", false, undefined);

        } else {

            if (users) {

                jsonString = messageFormatter.FormatMessage(err, "Update External User Successful", true, users);


            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No external user found", false, undefined);
            }
        }

        res.end(jsonString);
    });

}


function DeleteExternalUser(req, res) {


    logger.debug("DVP-UserService.DeleteExternalUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    ExternalUser.findOneAndRemove({_id: req.params.id, company: company, tenant: tenant}, function (err, user) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get External User Failed", false, undefined);
        } else {
            jsonString = messageFormatter.FormatMessage(undefined, "Delete External User Success", true, undefined);
        }
        res.end(jsonString);
    });
}

function CreateExternalUser(req, res) {

    logger.debug("DVP-UserService.CreateUser Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);

    if (req.body && req.body.firstname && req.body.lastname && req.body.phone ) {
        var extUser = ExternalUser({
            title: req.body.title,
            name: req.body.name,
            avatar: req.body.avatar,
            birthday: req.body.birthday,
            gender: req.body.gender,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            locale: req.body.locale,
            ssn: req.body.ssn,
            phone: req.body.phone,
            email: req.body.email,
            company: parseInt(req.user.company),
            tenant: parseInt(req.user.tenant),
            created_at: Date.now(),
            updated_at: Date.now(),
            tags: req.body.tags,
            contacts: [],
            custom_fields: []
        });

        if (req.body.address) {
            extUser.address = {
                zipcode: req.body.address.zipcode,
                number: req.body.address.number,
                street: req.body.address.street,
                city: req.body.address.city,
                province: req.body.address.province,
                country: req.body.address.country
            }
        }

        if (req.body.contacts) {
            req.body.contacts.map(function (item) {
                if (item) {
                    extUser.contacts.push({
                        contact: item.contact,
                        type: item.type,
                        display: item.display,
                        verified: false,
                        raw: {}
                    });
                }
            });
        }

        if (req.body.custom_fields) {
            req.body.custom_fields.map(function (item) {
                if (item && item.key) {
                    extUser.custom_fields.push({
                        field: item.key, value: item.value
                    });
                }
            });
        }

        extUser.save(function (err, user) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
                res.end(jsonString);
            } else {


                jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, user);
                res.end(jsonString);
            }
        });
    } else {


        jsonString = messageFormatter.FormatMessage(undefined, "Requre fields not found", false, undefined);
        res.end(jsonString);

    }
}

function UpdateExternalUser(req, res) {


    logger.debug("DVP-UserService.UpdateExternalUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, req.body, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update External User Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update External User Successful", true, users);

        }

        res.end(jsonString);
    });

}

function GetExternalUserProfileByInteraction(req, res) {


    logger.debug("DVP-UserService.GetExternalUserProfileByContact Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var category = req.params.category;
    var contact = req.params.contact;
    var jsonString;

    //////////////////////////////////////////older version///////////////////////////////////////////////////////
    /*
     var queryObject = {company: company, tenant: tenant};
     queryObject[category] = contact;

     var otherQuery = {company: company, tenant: tenant, "contacts.type":category ,"contacts.contact": contact};

     var orQuery = {$or:[queryObject, otherQuery]};
     */
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    var orArray = [];

    if (category == 'call' || category == 'sms') {

        var otherQuery = {company: company, tenant: tenant, "contacts.type": "phone", "contacts.contact": contact};
        orArray.push(otherQuery);

        var queryObject = {company: company, tenant: tenant};
        queryObject["phone"] = contact;

        orArray.push(queryObject);

        queryObject = {company: company, tenant: tenant};
        queryObject["landnumber"] = contact;

        orArray.push(queryObject);
    } else if (category == 'facebook-post' || category == 'facebook-chat') {


        var otherQuery = {company: company, tenant: tenant, "contacts.type": "facebook", "contacts.contact": contact};
        orArray.push(otherQuery);

        var queryObject = {company: company, tenant: tenant};
        queryObject["facebook"] = contact;

        orArray.push(queryObject);
    } else {

        var otherQuery = {company: company, tenant: tenant, "contacts.type": category, "contacts.contact": contact};
        orArray.push(otherQuery);

        var queryObject = {company: company, tenant: tenant};
        queryObject[category] = contact;

        orArray.push(queryObject);
    }


    var orQuery = {$or: orArray};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ExternalUser.find(orQuery).populate({
        path: 'form_submission',
        populate: {path: 'form'}
    }).exec(function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External Users Failed", false, undefined);

        } else {

            var userObjectArray = [];
            if (users) {

                jsonString = messageFormatter.FormatMessage(undefined, "Get External User Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External User Found", false, undefined);

            }

        }

        res.end(jsonString);
    });


}

function GetExternalUserProfileByContact(req, res) {


    logger.debug("DVP-UserService.GetExternalUserProfileByContact Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var category = req.params.category;
    var contact = req.params.contact;
    var jsonString;

    //////////////////////////////////////////older version///////////////////////////////////////////////////////

    var orArray = [];

    var otherQuery;
    var queryObject;

    if (category == 'call' || category == 'sms') {

        otherQuery = {company: company, tenant: tenant, "contacts.type": "phone", "contacts.contact": contact};


        queryObject = {company: company, tenant: tenant};
        queryObject["landnumber"] = contact;

        orArray.push(queryObject);


        queryObject = {company: company, tenant: tenant};
        queryObject["phone"] = contact;

        orArray.push(queryObject);


    } else if (category == 'facebook-post' || category == 'facebook-chat') {

        otherQuery = {company: company, tenant: tenant, "contacts.type": "facebook", "contacts.contact": contact};

        queryObject = {company: company, tenant: tenant};
        queryObject["facebook"] = contact;

        orArray.push(queryObject);

    } else if (category == 'chat') {

        otherQuery = {company: company, tenant: tenant, "contacts.type": "email", "contacts.contact": contact};


        queryObject = {company: company, tenant: tenant};
        queryObject["email"] = contact;

        orArray.push(queryObject);

    } else if (category == 'skype') {

        otherQuery = {company: company, tenant: tenant, "contacts.type": "skype", "contacts.contact": contact};


        queryObject = {company: company, tenant: tenant};
        queryObject["skype"] = contact;

        orArray.push(queryObject);

    } else {

        otherQuery = {company: company, tenant: tenant, "contacts.type": category, "contacts.contact": contact};


        queryObject = {company: company, tenant: tenant};
        queryObject[category] = contact;

        orArray.push(queryObject);
    }


    var orQuery = {$or: orArray};

    if (config.Host.profilesearch == "primary") {

        orQuery = queryObject;

    } else if (config.Host.profilesearch == "secondary") {

        orArray.push(otherQuery);
        orQuery = {$or: orArray};

    } else if (config.Host.profilesearch == "secondaryonly") {

        orQuery = otherQuery;

    } else {

        orArray.push(otherQuery);
        orQuery = {$or: orArray};
        logger.info("Selected default method, which may take longer .........");
    }


    logger.info(orQuery);

    ExternalUser.find(orQuery).populate({
        path: 'form_submission',
        populate: {path: 'form'}
    }).exec(function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External Users Failed", false, undefined);

        } else {

            var userObjectArray = [];
            if (users) {

                jsonString = messageFormatter.FormatMessage(undefined, "Get External User Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External User Found", false, undefined);

            }

        }

        res.end(jsonString);
    });


}

function GetExternalUserProfileBySSN(req, res) {


    logger.debug("DVP-UserService.GetExternalUserProfileByContact Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var ssn = req.params.ssn;
    var jsonString;

    var queryObject = {ssn: ssn, company: company, tenant: tenant};

    ExternalUser.find(queryObject).populate({
        path: 'form_submission',
        populate: {path: 'form'}
    }).exec(function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External Users Failed", false, undefined);

        } else {

            var userObjectArray = [];
            if (users) {

                jsonString = messageFormatter.FormatMessage(undefined, "Get External User Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External User Found", false, undefined);

            }

        }

        res.end(jsonString);
    });


}

function GetExternalUserProfileByField(req, res) {


    logger.debug("DVP-UserService.GetExternalUserProfileByContact Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var field = req.params.field;
    var value = req.params.value;
    var jsonString;

    var queryObject = {company: company, tenant: tenant};

    //var likeval = new RegExp('^'+value+'$', "i");
    queryObject[field] = value;

    ExternalUser.find(queryObject).populate({
        path: 'form_submission',
        populate: {path: 'form'}
    }).exec(function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External Users Failed", false, undefined);

        } else {

            var userObjectArray = [];
            if (users) {

                jsonString = messageFormatter.FormatMessage(undefined, "Get External User Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External User Found", false, undefined);

            }

        }
        res.end(jsonString);
    });
}

function UpdateExternalUserProfileContact(req, res) {

    logger.debug("DVP-UserService.UpdateExternalUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, {
        $addToSet: {
            contacts: {
                contact: req.params.contact,
                type: req.body.type,
                raw: req.body.raw_contact,
                verified: false
            }
        }
    }, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update External user contact Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(undefined, "Update External User contact Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function RemoveExternalUserProfileContact(req, res) {

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, {$pull: {'contacts': {'contact': req.params.contact}}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove External User Contact Failed", false, undefined);


        } else {

            jsonString = messageFormatter.FormatMessage(undefined, "Remove External User Contact successfully", false, undefined);

        }

        res.end(jsonString);


    });

    /*


     Person.findOne({_id: personId, 'things.id': 2}, {'things.$': 1},
     function(err, person) { ...
     */

}

function UpdateExternalUserProfilePhone(req, res) {

    logger.debug("DVP-UserService.UpdateExternalUserPhone Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, {phone: req.params.phone}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update External User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update External User phone number Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function UpdateExternalUserProfileEmail(req, res) {

    logger.debug("DVP-UserService.UpdateExternalUserProfileEmail Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, {email: req.params.email}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User email Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User email Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function BulkCreate(req, res) {


    /*

     var arr = [{ name: 'Star Wars' }, { name: 'The Empire Strikes Back' }];
     Movies.insertMany(arr, function(error, docs) {});

     */


    logger.debug("DVP-UserService.BulkCreate Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);


    if (req.body) {

        req.body.forEach(function (item) {
            item.company = company;
            item.tenant = tenant;

        });


        ExternalUser.insertMany(req.body, function (err, docs) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
                res.end(jsonString);
            } else {


                jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, docs);
                res.end(jsonString);
            }
        });

    } else {

        jsonString = messageFormatter.FormatMessage(undefined, "Object validation failed", false, undefined);
        res.end(jsonString);

    }
}

function SearchExternalUsers(req, res) {

    logger.debug("DVP-UserService.SearchExternalUsers Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    ExternalUser.find({
        $text: {$search: req.params.text},
        company: company,
        tenant: tenant
    }, {score: {$meta: "textScore"}}).populate({
        path: 'form_submission',
        populate: {path: 'form'}
    }).sort({score: {$meta: 'textScore'}})
        .exec(function (err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get External Users Failed", false, undefined);

            } else {

                if (users) {


                    jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

                } else {

                    jsonString = messageFormatter.FormatMessage(undefined, "No External Users Found", false, undefined);

                }
            }

            res.end(jsonString);
        });

}

function UpdateExternalUserProfileDynamicFields(req, res) {

    logger.debug("DVP-UserService.UpdateExternalUserProfileDynamicFields Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();


    var form;
    if (util.isArray(req.body)) {

        fields = [];

        req.body.forEach(function (item) {
            //console.log(item)

            fields.push({field: item.field, value: item.value});

        });

        form = {dynamic_form: {$each: fields}};

    } else {


        form = {dynamic_form: {field: req.body.field, value: req.body.value}};

    }


    // dynamic_form:[{field:{ type: String, required: true}, value:{ type: String, required: true}}],
    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, {$addToSet: form}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update External user fields Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(undefined, "Update External User fields Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function RemoveExternalUserProfileDynamicFields(req, res) {

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    ExternalUser.findOneAndUpdate({
        _id: req.params.id,
        company: company,
        tenant: tenant
    }, {$pull: {'dynamic_form': {'field': req.params.field}}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove External User fields Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(undefined, "Remove External User fields successfully", false, undefined);
        }
        res.end(jsonString);

    });

}

function UpdateFormSubmission(req, res) {

    logger.debug("DVP-UserService.FormSubmission Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var jsonString;


    ExternalUser.findOneAndUpdate({_id: req.params.id, company: company, tenant: tenant}, {
        updated_at: Date.now(),
        form_submission: req.body.form_submission
    }, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update External User Form Submission Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update External User  Form Submission Successful", true, undefined);

        }

        res.end(jsonString);
    });
}

function GetExternalUsersByTags(req, res) {


    logger.debug("DVP-UserService.GetExternalUsersByTags Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var tags = req.query.tags;
    var jsonString;
    ExternalUser.find({company: company, tenant: tenant, tags: {$all: tags}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External Users By Tags Failed", false, undefined);

        } else {

            if (users) {


                jsonString = messageFormatter.FormatMessage(err, "Get Users By Tags Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External Users Found", false, undefined);

            }
        }

        res.end(jsonString);
    });

}


function GetAccessibleFieldConfig(req, res) {


    logger.debug("DVP-UserService.GetAccessibleFieldConfig Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    ExternalUserAccessFields.findOne({company: company, tenant: tenant}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get External User Access Fields Failed", false, undefined);

        } else {

            if (users) {


                jsonString = messageFormatter.FormatMessage(err, "Get External User Access Fields Successful", true, users);

            } else {

                jsonString = messageFormatter.FormatMessage(undefined, "No External User Access filed data Found", true, undefined);

            }
        }

        res.end(jsonString);
    });

}

function UpdateAccessibleFieldConfig(req, res) {

    logger.debug("DVP-UserService.UpdateExternalUserFieldsAvailability Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var jsonString;

    ExternalUserAccessFields.findOneAndUpdate({
        company: company,
        tenant: tenant
    }, req.body.fields).exec(function (errUpdate, resUpdate) {

        if (errUpdate) {
            jsonString = messageFormatter.FormatMessage(errUpdate, "Update External User Available Fields Failed", false, undefined);
            res.end(jsonString);
        }
        else {
            if (resUpdate) {
                jsonString = messageFormatter.FormatMessage(undefined, "Update External User Available Fields Successful", true, undefined);
            }
            else {
                jsonString = messageFormatter.FormatMessage(new Error("Update External User Available Fields Failed"), "Update External User Available Fields Failed", false, undefined);
            }

            res.end(jsonString);
        }
    });


}

function AddDefaultAccessibleFields(company, tenant)
{
    try
    {
        var defaultFields =
        {
            "name":{"require":false,"view_enable":true,"editable":true},
            "title":{"require":false,"view_enable":true,"editable":true},
            "avatar":{"require":false,"view_enable":true,"editable":true},
            "birthday":{"require":false,"view_enable":true,"editable":true},
            "gender":{"require":false,"view_enable":true,"editable":true},
            "address":{"require":false,"view_enable":true,"editable":true},
            "firstname":{"require":true,"view_enable":true,"editable":true},
            "lastname":{"require":true,"view_enable":true,"editable":true},
            "locale":{"require":false,"view_enable":true,"editable":true},
            "ssn":{"require":false,"view_enable":true,"editable":true},
            "password":{"require":false,"view_enable":true,"editable":true},
            "primary_contacts":{"require":true,"view_enable":true,"editable":true},
            "secondary_contacts":{"require":false,"view_enable":true,"editable":true},
            "contacts":{"require":false,"view_enable":true,"editable":true},
            "tags":{"require":false,"view_enable":true,"editable":true},
            "company": company,
            "tenant": tenant
        };
        var userFields = ExternalUserAccessFields(defaultFields);

        userFields.save(function (errSave, resSave) {

            if (errSave) {
                console.log(messageFormatter.FormatMessage(errSave, "External User Available Fields Model already available", false, undefined));
            }
            else {
                if (resSave) {
                    console.log(messageFormatter.FormatMessage(undefined, "External User Available Fields Model added successfully", true, resSave))
                }
                else {
                    console.log(messageFormatter.FormatMessage(new Error("Failed to add External user unaccessible feilds "), "Failed to add External user unaccessible feilds ", true, resSave));
                }
            }
        });
    }
    catch(ex)
    {
        console.log('Error occurred');
    }

}

function AddAccessibleFieldConfig(req, res) {

    logger.debug("DVP-UserService.AddExternalUserAvailableFields Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var jsonString;

    try {
        if (req.body.fields) {
            req.body.fields.company = company;
            req.body.fields.tenant = tenant;

            var userFields = ExternalUserAccessFields(req.body.fields);

            userFields.save(function (errSave, resSave) {

                if (errSave) {
                    jsonString = messageFormatter.FormatMessage(errSave, "External User Available Fields Model already available", false, undefined);
                    res.end(jsonString);
                }
                else {
                    if (resSave) {
                        jsonString = messageFormatter.FormatMessage(undefined, "External User Available Fields Model added successfully", true, resSave);
                    }
                    else {
                        jsonString = messageFormatter.FormatMessage(new Error("Failed to add External user unaccessible feilds "), "Failed to add External user unaccessible feilds ", true, resSave);
                    }
                    res.end(jsonString);
                }
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("Empty request body found"), "Empty request body found", false, undefined);
            res.end(jsonString);
        }
    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : AddExternalUserAccessibleFields ", false, undefined);
        res.end(jsonString);
    }


}

function GetDefaultAccessibleFieldConfig(req, res) {


    var jsonString;

    try {

        var propsKeys = Object.keys(ExternalUserAccessFields.schema.paths);
        var propsAccess = Object.keys(AccessSchema.schema.paths);


        propsKeys.splice(propsKeys.indexOf('created_at'), 1);
        propsKeys.splice(propsKeys.indexOf('updated_at'), 1);
        propsKeys.splice(propsKeys.indexOf('_id'), 1);
        propsKeys.splice(propsKeys.indexOf('__v'), 1);
        propsAccess.splice(propsAccess.indexOf('_id'), 1);
        propsAccess.splice(propsAccess.indexOf('__v'), 1);


        var obj =
            {
                Keys: propsKeys,
                Sub_keys: propsAccess
            }


        jsonString = messageFormatter.FormatMessage(undefined, "Get External User Access Key Fields succeeded", true, obj);
        res.end(jsonString);

    } catch (e) {

        jsonString = messageFormatter.FormatMessage(e, "Error in operation : GetExternalUserAccessKeyFields", false, undefined);
        res.end(jsonString);
    }


}

function GetUserFields(req, res) {


    var jsonString;

    try {

        var propsKeys = ExternalUser.schema.paths;


        /*propsKeys.splice(propsKeys.indexOf('created_at'),1);
        propsKeys.splice(propsKeys.indexOf('updated_at'),1);
        propsKeys.splice(propsKeys.indexOf('_id'),1);
        propsKeys.splice(propsKeys.indexOf('__v'),1);*/

        jsonString = messageFormatter.FormatMessage(undefined, "Get External User Access Key Fields succeeded", true, propsKeys);
        res.end(jsonString);

    } catch (e) {

        jsonString = messageFormatter.FormatMessage(e, "Error in operation : GetExternalUserAccessKeyFields", false, undefined);
        res.end(jsonString);
    }


}

module.exports.GetExternalUsers = GetExternalUsers;
module.exports.GetExternalUser = GetExternalUser;
module.exports.DeleteExternalUser = DeleteExternalUser;
module.exports.CreateExternalUser = CreateExternalUser;
module.exports.UpdateExternalUser = UpdateExternalUser;
module.exports.GetExternalUserProfileByContact = GetExternalUserProfileByContact;
module.exports.GetExternalUserProfileByInteraction = GetExternalUserProfileByInteraction;
module.exports.GetExternalUserProfileByField = GetExternalUserProfileByField;
module.exports.UpdateExternalUserProfileContact = UpdateExternalUserProfileContact;
module.exports.UpdateExternalUserProfileEmail = UpdateExternalUserProfileEmail;
module.exports.RemoveExternalUserProfileContact = RemoveExternalUserProfileContact;
module.exports.UpdateExternalUserProfilePhone = UpdateExternalUserProfilePhone;
module.exports.GetExternalUserProfileBySSN = GetExternalUserProfileBySSN;
module.exports.BulkCreate = BulkCreate;
module.exports.SearchExternalUsers = SearchExternalUsers;
module.exports.UpdateExternalUserProfileDynamicFields = UpdateExternalUserProfileDynamicFields;
module.exports.UpdateFormSubmission = UpdateFormSubmission;
module.exports.GetExternalUserAttribute = GetExternalUserAttribute;
module.exports.GetExternalUsersByTags = GetExternalUsersByTags;
module.exports.UpdateExternalUserAttribute = UpdateExternalUserAttribute;
module.exports.GetAccessibleFieldConfig = GetAccessibleFieldConfig;
module.exports.UpdateAccessibleFieldConfig = UpdateAccessibleFieldConfig;
module.exports.AddAccessibleFieldConfig = AddAccessibleFieldConfig;
module.exports.GetDefaultAccessibleFieldConfig = GetDefaultAccessibleFieldConfig;
module.exports.GetUserFields = GetUserFields;
module.exports.AddDefaultAccessibleFields = AddDefaultAccessibleFields;

