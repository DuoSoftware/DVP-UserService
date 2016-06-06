/**
 * Created by Heshan.i on 6/6/2016.
 */
var mongoose = require('mongoose');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var Org = require('./model/Organisation');
var User = require('./model/User');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

function GetOrganisations(req, res){
    logger.debug("DVP-UserService.GetOrganisations Internal method ");

    var tenant = parseInt(req.user.tenant);
    var jsonString;
    Org.find({tenant: tenant}, function(err, orgs) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisations Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(err, "Get Organisations Successful", true, orgs);
        }
        res.end(jsonString);
    });
}

function GetOrganisation(req, res){
    logger.debug("DVP-UserService.GetOrganisation Internal method ");

    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Successful", true, org);
        }
        res.end(jsonString);
    });
}


function DeleteOrganisation(req,res){
    logger.debug("DVP-UserService.DeleteOrganisation Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.find({tenant: tenant, id: company}, function(err, users) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(users.length>0){
                jsonString = messageFormatter.FormatMessage(undefined, "Users Available, Denied Remove Organisation", false, undefined);
                res.end(jsonString);
            }else {
                Org.findOne({tenant: tenant, id: company}, function (err, org) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
                        res.end(jsonString);
                    } else {
                        if (org) {
                            org.remove(function (err) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Delete Organisation Failed", false, undefined);
                                } else {
                                    jsonString = messageFormatter.FormatMessage(undefined, "Organisation successfully deleted", true, undefined);
                                }
                                res.end(jsonString);
                            });
                        } else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Delete Organisation Failed, user object is null", false, undefined);
                            res.end(jsonString);
                        }
                    }
                });
            }
        }
    });
}


function CreateOrganisation(req, res){
    logger.debug("DVP-UserService.CreateOrganisation Internal method ");
    var jsonString;
    var org = Org({
        owner_name: req.body.owner.name,
        company_name: req.body.name,
        company_enabled: true,
        id: 3,
        tenant: 1,
        created_at: Date.now(),
        updated_at: Date.now()
    });

    var user = User({
        name: req.body.owner.name,
        username: req.body.owner.username,
        password: req.body.owner.password,
        phoneNumber: {contact:req.body.owner.phone, type: "phone", verified: false},
        email:{contact:req.body.owner.mail, type: "phone", verified: false},
        user_meta: {},
        app_meta: {},
        company: 3,
        tenant: 1,
        user_scopes: {},
        created_at: Date.now(),
        updated_at: Date.now()

    });

    user.save(function(err, user) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
            res.end(jsonString);
        }else{
            org.save(function(err, org) {
                if (err) {
                    user.remove(function (err) {});
                    jsonString = messageFormatter.FormatMessage(err, "Organisation save failed", false, undefined);
                }else{
                    var jsonString = messageFormatter.FormatMessage(undefined, "Organisation saved successfully", true, org);
                }
                res.end(jsonString);
            });
        }
    });
}


function UpdateOrganisation(req, res){
    logger.debug("DVP-UserService.UpdateOrganisation Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    Org.findOneAndUpdate({tenant: tenant, id: company}, req.body, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Update Organisation Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(err, "Update Organisation Successful", true, org);
        }
        res.end(jsonString);
    });
}


module.exports.GetOrganisation = GetOrganisation;
module.exports.GetOrganisations = GetOrganisations;
module.exports.DeleteOrganisation = DeleteOrganisation;
module.exports.CreateOrganisation = CreateOrganisation;
module.exports.UpdateOrganisation = UpdateOrganisation;