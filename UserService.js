var mongoose = require('mongoose');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var User = require('dvp-mongomodels/model/User');
var Org = require('dvp-mongomodels/model/Organisation');
var VPackage = require('dvp-mongomodels/model/Package');
var Console = require('dvp-mongomodels/model/Console');
var UserTag = require('dvp-mongomodels/model/Tag').SimpleTag;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var PublishToQueue = require('./Worker').PublishToQueue;
var util = require('util');
var crypto = require('crypto');
var config = require('config');
var redis = require('ioredis');
var bcrypt = require('bcryptjs');
var DbConn = require('dvp-dbmodels');


var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redispass = config.Redis.password;
var redismode = config.Redis.mode;
var redisdb = config.Redis.db;



var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    password: redispass,
    db: redisdb,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(config.Redis.sentinels && config.Redis.sentinels.hosts && config.Redis.sentinels.port, config.Redis.sentinels.name){
        var sentinelHosts = config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){

                sentinelConnections.push({host: item, port:config.Redis.sentinels.port})

            })

            redisSetting = {
                sentinels:sentinelConnections,
                name: config.Redis.sentinels.name,
                password: redispass
            }

        }else{

            console.log("No enough sentinel servers found .........");
        }

    }
}

var redisClient = undefined;

if(redismode != "cluster") {
    redisClient = new redis(redisSetting);
}else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts)){


        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass});
        });

        var redisClient = new redis.Cluster([redisSetting]);

    }else{

        redisClient = new redis(redisSetting);
    }


}

redisClient.on('error', function (err) {
    console.log('Error '.red, err);
});



function GetUsers(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;



    User.find({company: company, tenant: tenant, systemuser: true, Active: true})
        .select("-password")
        .exec( function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

            }else {

                if (users) {

                    jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

                }else{

                    jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);

                }
            }

            res.end(jsonString);
        });

}

function GetExternalUsers(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.find({company: company, tenant: tenant, systemuser: false})
        .select("-password")
        .exec( function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

            }else {

                if (users) {


                    jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

                }else{

                    jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);

                }
            }

            res.end(jsonString);
        });

}

function GetUser(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    var query = {username: req.params.name,company: company, tenant: tenant};

    User.findOne(query)
        .select("-password")
        .exec( function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

            }else{

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

            }

            res.end(jsonString);
        });








}

function GetUsersByIDs(req, res){


    logger.debug("DVP-UserService.GetUsersByID Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    var query = {_id: {$in:req.query.id},company: company, tenant: tenant, Active: true};

    if(!util.isArray(req.query.id))
        query = {_id: req.query.id,company: company, tenant: tenant, Active: true};



    User.findOne(query).select("-password")
        .exec(  function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

            }else{


                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

            }

            res.end(jsonString);
        });

}

function GetUsersByRole(req, res){


    logger.debug("DVP-UserService.GetUsersByRole Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    var query = {_id: {$in:req.query.id},company: company, tenant: tenant, Active: true};

    if(!util.isArray(req.query.id))
        query = {_id: req.query.id,company: company, tenant: tenant, Active: true};





    User.find({company:company , tenant:tenant,'user_meta.role':req.params.role}).select("-password")
        .exec(  function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

            }else{


                jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

            }

            res.end(jsonString);
        });

}

function GetUsersByRoles(req, res){


    logger.debug("DVP-UserService.GetUsersByRoles Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;




    var qObj = {
        company:company,
        tenant:tenant,
        $or:[],
        Active: true
    }

    req.body.roles.forEach(function (item) {
        qObj.$or.push({'user_meta.role':item});
    });


    User.find(qObj).select("-password")
        .exec(  function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

            }else{


                jsonString = messageFormatter.FormatMessage(err, "Get Users Successful", true, users);

            }

            res.end(jsonString);
        });

}

function UserExists(req, res){


    logger.debug("DVP-UserService.UserExists Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{


            if(users)
            {
                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, undefined);

            }else{

                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

            }

        }

        res.end(jsonString);
    });

}

function OwnerExists(req, res){


    logger.debug("DVP-UserService.OwnerExsists Internal method ");


    var jsonString;
    User.findOne({username: req.params.name}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Owner Failed", false, undefined);

        }else{

            //var userObj = false;
            if(users)
            {
                jsonString = messageFormatter.FormatMessage(err, "Get Owner Successful", true, undefined);

            }else{

                jsonString = messageFormatter.FormatMessage(err, "Get Owner Failed", false, undefined);
            }




        }

        res.end(jsonString);
    });

}

function DeleteUser(req,res){


    logger.debug("DVP-UserService.DeleteUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            console.log(jsonString);
        } else {

            if(org.ownerId == req.params.name){

                jsonString = messageFormatter.FormatMessage(undefined, "Delete organization owner failed", false, undefined);
                console.log(jsonString);

            }else {

                User.findOneAndUpdate({
                    username: req.params.name,
                    company: company,
                    tenant: tenant
                }, {Active:false}, function (err, user) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);
                    } else {
                        Org.findOne({tenant: tenant, id: company}, function (err, org) {
                            if (err) {
                                jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
                                console.log(jsonString);
                            } else {
                                var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", user.user_meta.role);
                                if (limitObj) {
                                    var userIndex = limitObj.currentAccess.indexOf(user.username);
                                    if (userIndex > -1) {
                                        limitObj.currentAccess.splice(userIndex, 1);
                                        Org.findOneAndUpdate({id: company, tenant: tenant}, org, function (err, rOrg) {
                                            if (err) {
                                                jsonString = messageFormatter.FormatMessage(err, "Update Console Access Limit Failed", false, undefined);
                                                console.log(jsonString);
                                            } else {
                                                jsonString = messageFormatter.FormatMessage(err, "Update Console Access Limit Success", true, undefined);
                                                console.log(jsonString);
                                            }
                                        });
                                    }
                                } else {
                                    console.log("Failed to update currentAccess, Cannot find Org accessType");
                                }
                            }
                        });
                        jsonString = messageFormatter.FormatMessage(undefined, "Delete User Success", true, undefined);
                    }
                    res.end(jsonString);
                });
            }
        }
    });

}

function CreateUser(req, res){

    logger.debug("DVP-UserService.CreateUser Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(org){
                if(req.body.role && req.body.mail){
                    var userRole = req.body.role.toLowerCase();
                    var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", userRole);
                    if(limitObj){
                        if(limitObj.accessLimit > limitObj.currentAccess.length){

                            if(!req.body.address)
                            {
                                req.body.address = {};
                            }


                            var user = User({
                                systemuser: true,
                                title: req.body.title,
                                name: req.body.name,
                                avatar: req.body.avatar,
                                birthday: req.body.birthday,
                                Active: true,
                                gender: req.body.gender,
                                firstname: req.body.firstname,
                                lastname: req.body.lastname,
                                locale: req.body.locale,
                                ssn: req.body.ssn,
                                address:{
                                    zipcode: req.body.address.zipcode,
                                    number: req.body.address.number,
                                    street: req.body.address.street,
                                    city: req.body.address.city,
                                    province: req.body.address.province,
                                    country: req.body.address.country,


                                },
                                username: req.body.mail,
                                password: req.body.password,
                                phoneNumber: {contact:req.body.phone, type: "phone", verified: false},
                                email:{contact:req.body.mail, type: "phone", verified: false},
                                company: parseInt(req.user.company),
                                tenant: parseInt(req.user.tenant),
                                user_meta: {role: userRole},
                                created_at: Date.now(),
                                updated_at: Date.now()
                            });

                            if(config.auth.login_verification){

                                user.verified = false;

                            }else{

                                user.verified = true;
                            }



                            user.save(function(err, user) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
                                    res.end(jsonString);
                                }else{
                                    /*Org.findOneAndUpdate({company: company, tenant: tenant},{$filter: {input: "$consoleAccessLimits", as: "consoleAccessLimit", cond: { $eq: [ "$$consoleAccessLimit.accessType", userRole] }}, $addToSet :{$consoleAccessLimit : user.username}}, function(err, rUsers) {
                                     if (err) {
                                     user.remove(function (err) {});
                                     jsonString = messageFormatter.FormatMessage(err, "Update Limit Failed, Rollback User Creation", false, undefined);
                                     }else{
                                     jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, user);
                                     }
                                     res.end(jsonString);
                                     });*/

                                    limitObj.currentAccess.push(user.username);
                                    Org.findOneAndUpdate({id: company, tenant: tenant},org, function(err, rOrg) {
                                        if (err) {
                                            user.remove(function (err) {});
                                            jsonString = messageFormatter.FormatMessage(err, "Update Limit Failed, Rollback User Creation", false, undefined);
                                        }else{

                                            if(config.auth.login_verification){

                                                crypto.randomBytes(20, function (err, buf) {
                                                    var token = buf.toString('hex');

                                                    var url = config.auth.ui_host + '#/activate/' + token;

                                                    redisClient.set("activate"+":"+token,user._id ,function (err, val) {
                                                        if (err) {

                                                            jsonString = messageFormatter.FormatMessage(err, "Create activation token failed", false, user);
                                                            res.end(jsonString);

                                                        }else{


                                                            redisClient.expireat("activate"+":"+token,  parseInt((+new Date)/1000) + 86400);

                                                            var sendObj = {
                                                                "company": 0,
                                                                "tenant": 1
                                                            };

                                                            sendObj.to =  req.body.mail;
                                                            sendObj.from = "no-reply";
                                                            sendObj.template = "By-User Registration Confirmation";
                                                            sendObj.Parameters = {username: user.username,
                                                                created_at: new Date(),
                                                                url:url}

                                                            PublishToQueue("EMAILOUT", sendObj)

                                                            jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                            res.end(jsonString);
                                                        }
                                                    });

                                                });
                                            }else{

                                                jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                res.end(jsonString);
                                            }

                                        }

                                    });
                                }
                            });
                        }else{
                            jsonString = messageFormatter.FormatMessage(err, "User Limit Exceeded", false, undefined);
                            res.end(jsonString);
                        }
                    }else{
                        jsonString = messageFormatter.FormatMessage(err, "Invalid User Role", false, undefined);
                        res.end(jsonString);
                    }
                }else{
                    jsonString = messageFormatter.FormatMessage(err, "No User Role Found", false, undefined);
                    res.end(jsonString);
                }
            }else{
                jsonString = messageFormatter.FormatMessage(err, "Organisation Data NotFound", false, undefined);
                res.end(jsonString);
            }
        }
    });
}

function ReActivateUser(req, res){

    logger.debug("DVP-UserService.ReActivateUser Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(org){
                User.findOne({company: company, tenant: tenant, username: req.params.username, Active: false})
                    .select("-password")
                    .exec( function(err, user) {
                        if (err) {

                            jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);
                            res.end(jsonString);
                        }else {

                            if (user) {

                                if(user.user_meta.role){
                                    var userRole = user.user_meta.role.toLowerCase();
                                    var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", userRole);
                                    if(limitObj){
                                        if(limitObj.accessLimit > limitObj.currentAccess.length){

                                            User.findOneAndUpdate({
                                                username: user.username,
                                                company: company,
                                                tenant: tenant
                                            }, {Active:true}, function (err, updatedUser) {
                                                if (err) {
                                                    jsonString = messageFormatter.FormatMessage(err, "Re-Activate User Failed", false, undefined);
                                                } else {


                                                    if(updatedUser) {
                                                        limitObj.currentAccess.push(updatedUser.username);
                                                        Org.findOneAndUpdate({
                                                            id: company,
                                                            tenant: tenant
                                                        }, org, function (err, rOrg) {
                                                            if (err) {
                                                                console.log(messageFormatter.FormatMessage(err, "Update Limit Failed", false, undefined));
                                                            } else {

                                                                console.log(messageFormatter.FormatMessage(err, "Update Limit Success", false, undefined));

                                                            }

                                                        });
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Re-Activate User Success", true, undefined);
                                                    }else{
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Re-Activate User Failed", true, undefined);
                                                    }




                                                }
                                                res.end(jsonString);
                                            });

                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "User Limit Exceeded", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Invalid User Role", false, undefined);
                                        res.end(jsonString);
                                    }
                                }else{
                                    jsonString = messageFormatter.FormatMessage(err, "No User Role Found", false, undefined);
                                    res.end(jsonString);
                                }

                            }else{

                                jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);
                                res.end(jsonString);

                            }
                        }

                    });

            }else{
                jsonString = messageFormatter.FormatMessage(err, "Organisation Data NotFound", false, undefined);
                res.end(jsonString);
            }
        }
    });
}

function CreateExternalUser(req, res) {

    logger.debug("DVP-UserService.CreateUser Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);

    if(req.body) {

        if (!req.body.address) {
            req.body.address = {};
        }


        var user = User({
            systemuser: false,
            name: req.body.name,
            avatar: req.body.avatar,
            birthday: req.body.birthday,
            gender: req.body.gender,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            locale: req.body.locale,
            ssn: req.body.ssn,
            address: {
                zipcode: req.body.address.zipcode,
                number: req.body.address.number,
                street: req.body.address.street,
                city: req.body.address.city,
                province: req.body.address.province,
                country: req.body.address.country,
            },
            username: req.body.username,
            phoneNumber: {contact: req.body.phone, type: "phone", verified: false},
            email: {contact: req.body.mail, type: "phone", verified: false},
            company: parseInt(req.user.company),
            tenant: parseInt(req.user.tenant),
            created_at: Date.now(),
            updated_at: Date.now()
        });


        user.save(function (err, user) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);

            } else {
                jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, user);
            }
            res.end(jsonString);
        });
    }else{

        jsonString = messageFormatter.FormatMessage(undefined, "Requestbody empty", false, undefined);
        res.end(jsonString);


    }
}

function UpdateUser(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();

    if(req.params.name) {

        User.findOneAndUpdate({
            username:req.params.name,
            company: company,
            tenant: tenant
        }, req.body, function (err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

            } else {
                if(users)
                {
                    jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, users);
                }
                else
                {
                    jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);
                }


            }

            res.end(jsonString);
        });
    }else{

        jsonString = messageFormatter.FormatMessage(new Error('Update User Failed Username empty'), "Update User Failed Username empty", false, undefined);
        res.end(jsonString);

    }

}


function UpdateUserProfilePassword(req, res) {

    logger.debug("DVP-UserService.UpdateUserProfilePassword Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;

    req.body.updated_at = Date.now();


    var jsonString;

    if (req.params.name) {
        User.findOne({
            username: req.params.name,
            company: company,
            tenant: tenant
        }, function (err, existingUser) {
            if (!existingUser || err) {

                jsonString = messageFormatter.FormatMessage(undefined, "User not exists", false, undefined);
                res.end(jsonString);


            } else {

                crypto.randomBytes(20, function (err, buf) {
                    var token = buf.toString('hex');

                    // var url = config.auth.ui_host + '#/reset/' + token;

                    redisClient.set("reset" + ":" + token, existingUser._id.toString(), function (err, val) {
                        if (err) {

                            jsonString = messageFormatter.FormatMessage(undefined, "Error in process", false, undefined);
                            res.end(jsonString);

                        } else {


                            redisClient.expireat("reset" + ":" + token, parseInt((+new Date) / 1000) + 86400);
                            var sendObj = {
                                "company": 0,
                                "tenant": 1
                            };

                            //existingUser.url = url;

                            //sendObj.to = req.body.email;
                            //sendObj.from = "no-reply";
                            //sendObj.template = "By-User Reset Password";
                            //sendObj.Parameters = {
                            //    username: existingUser.username,
                            //    url: url
                            //};
                            //
                            //PublishToQueue("EMAILOUT", sendObj);

                            jsonString = messageFormatter.FormatMessage(undefined, "Reset token generated", true, token);
                            res.end(jsonString);
                        }
                    });

                });
            }
        });
    } else {

        jsonString = messageFormatter.FormatMessage(undefined, "Email is not valid", false, undefined);
        res.end(jsonString);
    }
}

function UpdateMyPassword(req, res){

    logger.debug("DVP-UserService.UpdateUserPassword Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;

    req.body.updated_at = Date.now();

    if(user && req.body.oldpassword && req.body.newpassword) {

        User.findOne({
            username: user,
            company: company,
            tenant: tenant

        }, '+password', function (err, myprofile) {

            //{password: req.body.newpassword},
            //password: req.body.oldpassword

            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Update User Password Failed", false, undefined);
                res.end(jsonString);

            } else {

                jsonString = messageFormatter.FormatMessage(err, "Update User Password Successful", true, undefined);

                if(myprofile){

                    myprofile.comparePassword(req.body.oldpassword, function (err, isMatch) {
                        if (!isMatch) {

                            jsonString = messageFormatter.FormatMessage(err, "Update User Password Failed No User Found", false, undefined);
                            res.end(jsonString);

                        }else{

                            bcrypt.genSalt(10, function(err, salt) {
                                bcrypt.hash(req.body.newpassword, salt, function(err, hash) {
                                    User.findOneAndUpdate({
                                        _id: myprofile._id
                                    }, {password:hash}, function (err, users) {
                                        if (err) {
                                            jsonString = messageFormatter.FormatMessage(err, "Update User Password Failed", false, undefined);
                                        } else {
                                            jsonString = messageFormatter.FormatMessage(err, "Update User Password Successful", true, undefined);
                                        }
                                        res.end(jsonString);
                                    });
                                });
                            });
                        }
                    });

                }else{

                    jsonString = messageFormatter.FormatMessage(err, "Update User Password Failed No User Found", false, undefined);
                    res.end(jsonString);
                }
            }
        });
    }else{

        jsonString = messageFormatter.FormatMessage(err, "Update User Failed Username empty", false, undefined);
        res.end(jsonString);

    }

}

function GetMyrProfile(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    try {
        User.findOne({username: req.user.iss, company: company, tenant: tenant}).select("-password")
            .exec(function (err, users) {
                if (err) {

                    jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

                } else {

                    jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

                }

                res.end(jsonString);
            });
    }catch(ex){

        console.log(ex);
    }


}

function UpdateMyUser(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: userName,company: company, tenant: tenant}, req.body, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function GetUserProfileByResourceId(req, res){


    logger.debug("DVP-UserService.GetUserProfileByResourceId Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var jsonString;



    User.findOne({resourceid: req.params.resourceid ,company: company, tenant: tenant}).select("-password")
        .exec(   function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

            }else{


                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

            }

            res.end(jsonString);
        });


}

function GetUserProfileByContact(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var category = req.params.category;
    var contact = req.params.contact;
    var jsonString;

    var queryObject = {company: company, tenant: tenant};
    queryObject[category+".contact"] = contact
    User.find(queryObject).select("-password")
        .exec(   function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

            }else{

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users);

            }

            res.end(jsonString);
        });


}

function GetExternalUserProfile(req, res){


    logger.debug("DVP-UserService.GetExternalUserProfile Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}).select("-password")
        .exec(   function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get External User Failed", false, undefined);

            }else{


                jsonString = messageFormatter.FormatMessage(undefined, "Get External User Successful", true, users);

            }

            res.end(jsonString);
        });


}

function GetUserProfile(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}).select("-password")
        .exec(  function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

            }else{


                jsonString = messageFormatter.FormatMessage(undefined, "Get User Successful", true, users);

            }

            res.end(jsonString);
        });


}

function UpdateUserProfile(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    if (req.body.username) {

        delete req.body.username;
    }

    if (req.body.password) {

        delete req.body.password;

    }

    if (req.body.company) {

        delete req.body.company;

    }
    if (req.body.tenant) {

        delete req.body.tenant;

    }

    if (req.body.contacts) {

        delete req.body.contacts;

    }


    if (req.body.user_meta) {

        delete req.body.user_meta;

    }

    if (req.body.app_meta) {

        delete req.body.app_meta;

    }


    if (req.body.user_scopes) {

        delete req.body.user_scopes;

    }


    if (req.body.client_scopes) {

        delete req.body.client_scopes;

    }


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, req.body, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function UpdateMyUserProfile(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;


    if (req.body.userName) {

        delete req.body.userName;
    }

    if (req.body.password) {

        delete req.body.password;

    }

    if (req.body.company) {

        delete req.body.company;

    }


    if (req.body.contacts) {

        delete req.body.contacts;

    }


    if (req.body.user_meta) {

        delete req.body.user_meta;

    }

    if (req.body.app_meta) {

        delete req.body.app_meta;

    }


    if (req.body.user_scopes) {

        delete req.body.user_scopes;

    }


    if (req.body.client_scopes) {

        delete req.body.client_scopes;

    }


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: userName, company: company, tenant: tenant}, req.body, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function GetMyARDSFriendlyContactObject(req,res){


    logger.debug("DVP-UserService.GetARDSFriendlyContactObject Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var username = req.user.iss;
    var contact = req.params.contact;
    var jsonString;
    User.findOne({username: username,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{



            var contactObj = {};

            /*

             {"ContactName": "bob","Domain": "159.203.160.47","Extention":2002,"ContactType": "PRIVATE"}


             var contactSchema = new Schema({
             contact:String,
             type:String,
             display: String,
             verified: Boolean
             }, {_id: false});



             */


            ////////////////////////////////////////////
            if(users && users.contacts) {


                var contactinfo = users[contact];

                contactObj.Profile = users.username;

                if(!contactinfo){


                    contactinfo = users.contacts.filter(function (item) {
                        return item.contact == contact;
                    });



                }


                if(contactinfo && contactinfo.contact){




                    var infoArr = contactinfo.contact.split("@");
                    if(infoArr.length > 1){

                        contactObj.ContactName = infoArr[0];
                        contactObj.Domain =  infoArr[1];
                    }else{

                        contactObj.ContactName = contactinfo.contact;
                    }


                    if(contactinfo.display) {
                        contactObj.Extention = contactinfo.display;
                    }else{

                        contactObj.Extention = contactObj.ContactName;


                    }


                    contactObj.ContactType = "PUBLIC";


                    if(contact == "veeryaccount")
                        contactObj.ContactType = "PRIVATE";

                }


            }

            ///////////////////////////////////////////

            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, contactObj);

        }

        res.end(jsonString);
    });


}

function GetARDSFriendlyContactObject(req,res){


    logger.debug("DVP-UserService.GetARDSFriendlyContactObject Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var contact = req.params.contact;
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{



            var contactObj = {};

            /*

             {"ContactName": "bob","Domain": "159.203.160.47","Extention":2002,"ContactType": "PRIVATE"}


             var contactSchema = new Schema({
             contact:String,
             type:String,
             display: String,
             verified: Boolean
             }, {_id: false});



             */


            ////////////////////////////////////////////
            if(users && users.contacts) {


                var contactinfo = users[contact];

                contactObj.Profile = users.username;

                if(!contactinfo){


                    contactinfo = users.contacts.filter(function (item) {
                        return item.contact == contact;
                    });



                }


                if(contactinfo && contactinfo.contact){




                    var infoArr = contactinfo.contact.split("@");
                    if(infoArr.length > 1){

                        contactObj.ContactName = infoArr[0];
                        contactObj.Domain =  infoArr[1];
                    }else{

                        contactObj.ContactName = contactinfo.contact;
                    }


                    if(contactinfo.display) {
                        contactObj.Extention = contactinfo.display;
                    }else{

                        contactObj.Extention = contactObj.ContactName;


                    }


                    contactObj.ContactType = "PUBLIC";


                    if(contact == "veeryaccount")
                        contactObj.ContactType = "PRIVATE";

                }


            }

            ///////////////////////////////////////////

            jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, contactObj);

        }

        res.end(jsonString);
    });


}

function UpdateUserProfileEmail(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { email : {contact:req.params.email, type:"email", verified: false}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User email Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User email Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function UpdateUserProfileContact(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { $addToSet :{contacts : {contact:req.params.contact, type:req.body.type, verified: false}}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Successful", true, users);

        }

        res.end(jsonString);
    });

}

function RemoveMyUserProfileContact(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: userName,company: company, tenant: tenant},{ $pull: { 'contacts': {'contact':req.params.contact} } }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove contact Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove contact successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function UpdateMyUserProfileContact(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var userName = req.user.iss;
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: userName,company: company, tenant: tenant}, { $addToSet :{contacts : {contact:req.params.contact, type:req.body.type, verified: false}}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Successful", true, users);

        }

        res.end(jsonString);
    });

}

function RemoveUserProfileContact(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ $pull: { 'contacts': {'contact':req.params.contact} } }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove contact Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove contact successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function UpdateUserProfilePhone(req, res) {

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { phoneNumber : {contact:req.params.email, type:"voice", verified: false}}, function (err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Failed", false, undefined);

        } else {

            jsonString = messageFormatter.FormatMessage(err, "Update User phone number Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function SetUserProfileResourceId(req, res){

    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    req.body.updated_at = Date.now();
    if(req.params.name) {
        User.findOneAndUpdate({
            username: req.params.name,
            company: company,
            tenant: tenant
        }, {resourceid: req.params.resourceid}, function (err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Update User resource id Failed", false, undefined);

            } else {
                if (users) {
                    jsonString = messageFormatter.FormatMessage(err, "Update User resource id Successful", true, undefined);
                } else {
                    jsonString = messageFormatter.FormatMessage(err, "No User Found", false, undefined);
                }
            }

            res.end(jsonString);
        });
    }else{

        jsonString = messageFormatter.FormatMessage(err, "Update User resource id Failed Username empty", false, undefined);
        res.end(jsonString);

    }

}

function FilterObjFromArray(itemArray, field, value){
    var resultObj;
    for(var i in itemArray){
        var item = itemArray[i];
        if(item[field] == value){
            resultObj = item;
            break;
        }
    }
    return resultObj;
}

function UniqueArray(array) {
    var processed = [];
    if(array && Array.isArray(array)) {
        for (var i = array.length - 1; i >= 0; i--) {
            if (array[i] != null) {
                if (processed.indexOf(array[i]) < 0) {
                    processed.push(array[i]);
                } else {
                    array.splice(i, 1);
                }
            }
        }
        return array;
    }else{
        return [];
    }
}

function UniqueObjectArray(array, field) {
    var processed = [];
    if(array && Array.isArray(array)) {
        for (var i = array.length - 1; i >= 0; i--) {
            if (processed.indexOf(array[i][field]) < 0) {
                processed.push(array[i][field]);
            } else {
                array.splice(i, 1);
            }
        }
        return array;
    }else{
        return [];
    }
}

function AssignConsoleToUser(req,res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{

            Console.findOne({consoleName: req.params.consoleName}, function(err, appConsole) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Console Failed", false, undefined);
                    res.end(jsonString);
                }else{
                    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                                    res.end(jsonString);
                                } else {
                                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                        if(appConsole.consoleUserRoles.indexOf(assignUser.user_meta.role) > -1){
                                            var consoleAccessLimitObj = FilterObjFromArray(org.consoleAccessLimits,"accessType",assignUser.user_meta.role);
                                            //if(consoleAccessLimitObj && (consoleAccessLimitObj.currentAccess.indexOf(assignUser.username) > -1 || consoleAccessLimitObj.accessLimit > consoleAccessLimitObj.currentAccess.length)){
                                            if(consoleAccessLimitObj) {
                                                var consoleScope = FilterObjFromArray(assignUser.client_scopes,"consoleName",appConsole.consoleName);
                                                if(consoleScope){
                                                    jsonString = messageFormatter.FormatMessage(err, "Console Already Added", false, undefined);
                                                    res.end(jsonString);
                                                }else{
                                                    assignUser.client_scopes.push({consoleName: appConsole.consoleName, menus: []});
                                                }


                                                User.findOneAndUpdate({
                                                    username: req.params.username,
                                                    company: company,
                                                    tenant: tenant
                                                }, assignUser, function (err, rUser) {
                                                    if (err) {
                                                        jsonString = messageFormatter.FormatMessage(err, "Assign Console Failed", false, undefined);
                                                        res.end(jsonString);
                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Assign Console successfull", true, undefined);


                                                        var basicscopes = [{"scope": "myNavigation", "read": true}, {"scope": "myUserProfile", "read": true}];


                                                        User.findOneAndUpdate({
                                                            username: req.params.username,
                                                            company: company,
                                                            tenant: tenant
                                                        }, {$addToSet: {user_scopes: {$each: basicscopes}}}, function (err, rUsers) {
                                                            if (err) {
                                                                jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);
                                                            } else {
                                                                jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", true, undefined);
                                                            }
                                                            res.end(jsonString);
                                                        });

                                                        //res.end(jsonString);


                                                        //consoleAccessLimitObj.currentAccess.push(assignUser.username);
                                                        //consoleAccessLimitObj.currentAccess = UniqueArray(consoleAccessLimitObj.currentAccess);
                                                        //Org.findOneAndUpdate({
                                                        //    tenant: tenant,
                                                        //    id: company
                                                        //}, org, function (err, rOrg) {
                                                        //    if (err) {
                                                        //        jsonString = messageFormatter.FormatMessage(err, "Assign Console Failed", false, undefined);
                                                        //    } else {
                                                        //        jsonString = messageFormatter.FormatMessage(undefined, "Assign Console successfully", true, undefined);
                                                        //    }
                                                        //    console.log(jsonString);
                                                        //});
                                                    }

                                                });
                                            }else{
                                                //jsonString = messageFormatter.FormatMessage(err, "Access Denied, Console Access Limit Exceeded", false, undefined);
                                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No Console Access Limit Found", false, undefined);
                                                res.end(jsonString);
                                            }
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "Access Denied, No user permissions", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                        res.end(jsonString);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function RemoveConsoleFromUser(req,res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{

            Console.findOne({consoleName: req.params.consoleName}, function(err, appConsole) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Console Failed", false, undefined);
                    res.end(jsonString);
                }else{
                    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                                    res.end(jsonString);
                                } else {
                                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                        if(appConsole.consoleUserRoles.indexOf(assignUser.user_meta.role) > -1){
                                            var consoleAccessLimitObj = FilterObjFromArray(org.consoleAccessLimits,"accessType",assignUser.user_meta.role);
                                            //if(consoleAccessLimitObj && (consoleAccessLimitObj.currentAccess.indexOf(assignUser.username) > -1 || consoleAccessLimitObj.accessLimit > consoleAccessLimitObj.currentAccess.length)){
                                            if(consoleAccessLimitObj) {
                                                var consoleScope = FilterObjFromArray(assignUser.client_scopes,"consoleName",appConsole.consoleName);
                                                if(consoleScope){
                                                    for(var i in assignUser.client_scopes) {
                                                        var cs = assignUser.client_scopes[i];
                                                        if(cs.consoleName == appConsole.consoleName) {
                                                            var index = parseInt(i);
                                                            //for(var k in cs.)
                                                            assignUser.client_scopes.splice(index, 1);
                                                            break;
                                                        }
                                                    }
                                                }else{
                                                    jsonString = messageFormatter.FormatMessage(err, "Console Not Found", false, undefined);
                                                    res.end(jsonString);
                                                }


                                                User.findOneAndUpdate({
                                                    username: req.params.username,
                                                    company: company,
                                                    tenant: tenant
                                                }, assignUser, function (err, rUser) {
                                                    if (err) {
                                                        jsonString = messageFormatter.FormatMessage(err, "Remove Console Failed", false, undefined);
                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Remove Console successfull", true, undefined);
                                                        //for(var j in consoleAccessLimitObj.currentAccess) {
                                                        //    var cAccess = consoleAccessLimitObj.currentAccess[j];
                                                        //    if(cAccess == assignUser.username) {
                                                        //        var index = parseInt(j);
                                                        //        consoleAccessLimitObj.currentAccess.splice(index, 1);
                                                        //        break;
                                                        //    }
                                                        //}
                                                        //Org.findOneAndUpdate({
                                                        //    tenant: tenant,
                                                        //    id: company
                                                        //}, org, function (err, rOrg) {
                                                        //    if (err) {
                                                        //        jsonString = messageFormatter.FormatMessage(err, "Remove Console Failed", false, undefined);
                                                        //    } else {
                                                        //        jsonString = messageFormatter.FormatMessage(undefined, "Remove Console successfully", true, undefined);
                                                        //    }
                                                        //    console.log(jsonString);
                                                        //});
                                                    }
                                                    res.end(jsonString);
                                                });
                                            }else{
                                                //jsonString = messageFormatter.FormatMessage(err, "Access Denied, Console Access Limit Exceeded", false, undefined);
                                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No Console Access Limit Found", false, undefined);
                                                res.end(jsonString);
                                            }
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "Access Denied, No user permissions", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                        res.end(jsonString);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function AddUserScopes(req, res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;

    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            User.findOne({username: adminUserName,company: company, tenant: tenant}, function(err, adminUser) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                    res.end(jsonString);
                } else {
                    User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                /*
                                 assignUser.user_scopes.push(req.body);
                                 assignUser.user_scopes = UniqueObjectArray(assignUser.user_scopes,"scope");
                                 User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},assignUser, function(err, rUsers) {
                                 if (err) {
                                 jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);
                                 }else{
                                 jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", false, undefined);
                                 }
                                 res.end(jsonString);
                                 });
                                 */
                                User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ $addToSet :{user_scopes : req.body}}, function(err, rUsers) {
                                    if (err) {
                                        jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", true, undefined);
                                    }
                                    res.end(jsonString);
                                });
                                //{ $addToSet :{user_scopes : req.body}}
                            }else{
                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                res.end(jsonString);
                            }
                        }
                    });
                }
            });
        }
    });


    //Show.update({ "_id": showId },{ "$push": { "episodes": episodeData } },callback)





}

function RemoveUserScopes(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ "$pull": { "user_scopes": {"scope":req.params.scope} } }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update user scope Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Update user scope successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function AddUserAppScopes(req, res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{

            Console.findOne({consoleName: req.params.consoleName}, function(err, appConsole) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Validate Console Failed", false, undefined);
                    res.end(jsonString);
                }else{
                    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
                            res.end(jsonString);
                        } else {
                            User.findOne({username: req.params.username,company: company, tenant: tenant}, function(err, assignUser) {
                                if (err) {
                                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigning User Failed", false, undefined);
                                    res.end(jsonString);
                                } else {
                                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin"){
                                        if(appConsole.consoleUserRoles.indexOf(assignUser.user_meta.role) > -1){
                                            var consoleAccessLimitObj = FilterObjFromArray(org.consoleAccessLimits,"accessType",assignUser.user_meta.role);
                                            //if(consoleAccessLimitObj && (consoleAccessLimitObj.currentAccess.indexOf(assignUser.username) > -1 || consoleAccessLimitObj.accessLimit > consoleAccessLimitObj.currentAccess.length)){
                                            if(consoleAccessLimitObj) {
                                                var consoleScope = FilterObjFromArray(assignUser.client_scopes,"consoleName",appConsole.consoleName);
                                                if(consoleScope){
                                                    var menuItem = FilterObjFromArray(consoleScope.menus,"menuItem",req.body.menuItem);
                                                    if(menuItem){
                                                        for(var j=0; j<menuItem.menuAction.lenth; j++){
                                                            var menuAction = FilterObjFromArray(menuItem.menuAction, "scope", menuItem.menuAction[j].scope);
                                                            if(menuAction){
                                                                menuAction.read = req.body.menuAction[j].read;
                                                                menuAction.write = req.body.menuAction[j].write;
                                                                menuAction.delete = req.body.menuAction[j].delete;
                                                            }else{
                                                                assignUser.user_scopes.push(req.body.menuAction);
                                                            }
                                                        }
                                                    }else {
                                                        consoleScope.menus.push(req.body);
                                                        consoleScope.menus = UniqueObjectArray(consoleScope.menus, "menuItem");
                                                    }
                                                }else{
                                                    assignUser.client_scopes.push({consoleName: appConsole.consoleName, menus: [req.body]});
                                                }
                                                for(var i in req.body.menuAction){
                                                    var userScope = FilterObjFromArray(assignUser.user_scopes, "scope", req.body.menuAction[i].scope);
                                                    if(userScope){
                                                        userScope.read = req.body.menuAction[i].read;
                                                        userScope.write = req.body.menuAction[i].write;
                                                        userScope.delete = req.body.menuAction[i].delete;
                                                    }else{
                                                        assignUser.user_scopes.push(req.body.menuAction[i]);
                                                    }
                                                }

                                                User.findOneAndUpdate({
                                                    username: req.params.username,
                                                    company: company,
                                                    tenant: tenant
                                                }, assignUser, function (err, rUser) {
                                                    if (err) {
                                                        jsonString = messageFormatter.FormatMessage(err, "Update client scope Failed", false, undefined);
                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Update client scope successfully", true, undefined);
                                                        //consoleAccessLimitObj.currentAccess.push(assignUser.username);
                                                        //consoleAccessLimitObj.currentAccess = UniqueArray(consoleAccessLimitObj.currentAccess);
                                                        //Org.findOneAndUpdate({
                                                        //    tenant: tenant,
                                                        //    id: company
                                                        //}, org, function (err, rOrg) {
                                                        //    if (err) {
                                                        //        jsonString = messageFormatter.FormatMessage(err, "Update client scope Failed", false, undefined);
                                                        //    } else {
                                                        //        jsonString = messageFormatter.FormatMessage(undefined, "Update client scope successfully", false, undefined);
                                                        //    }
                                                        //    console.log(jsonString);
                                                        //});
                                                    }
                                                    res.end(jsonString);
                                                });
                                            }else{
                                                //jsonString = messageFormatter.FormatMessage(err, "Access Denied, Console Access Limit Exceeded", false, undefined);
                                                jsonString = messageFormatter.FormatMessage(err, "Access Denied, No Console Access Limit Found", false, undefined);
                                                res.end(jsonString);
                                            }
                                        }else{
                                            jsonString = messageFormatter.FormatMessage(err, "Access Denied, No user permissions", false, undefined);
                                            res.end(jsonString);
                                        }
                                    }else{
                                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                                        res.end(jsonString);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function RemoveUserAppScopes(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var adminUserName = req.user.iss;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOne({username: adminUserName, company:company, tenant: tenant}, function(err, adminUser) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Validate Admin User Failed", false, undefined);
            res.end(jsonString);
        } else {
            User.findOne({
                $and: [{"client_scopes.consoleName": req.params.consoleName}, {
                    username: req.params.username,
                    company: company,
                    tenant: tenant
                }]
            }, function (err, user) {
                if(err){
                    jsonString = messageFormatter.FormatMessage(err, "Validate Assigned User Failed", false, undefined);
                    res.end(jsonString);
                }else {
                    if(adminUser && adminUser.user_meta.role != undefined && adminUser.user_meta.role == "admin") {
                        for (var i in user.client_scopes) {
                            var cScope = user.client_scopes[i];
                            if (cScope.consoleName == req.params.consoleName) {
                                for (var j in cScope.menus) {
                                    var menu = cScope.menus[j];
                                    if (menu.menuItem == req.params.navigation) {
                                        cScope.menus.splice(j, 1);
                                        break;
                                    }
                                }
                            }
                        }
                        User.findOneAndUpdate({
                            $and: [{"client_scopes.consoleName": req.params.consoleName}, {
                                username: req.params.username,
                                company: company,
                                tenant: tenant
                            }]
                        }, user, function (err, users) {
                            if (err) {
                                jsonString = messageFormatter.FormatMessage(err, "Remove Navigation scope Failed", false, undefined);
                            } else {
                                jsonString = messageFormatter.FormatMessage(undefined, "Remove Navigation successfull", true, undefined);
                            }
                            res.end(jsonString);
                        });
                    }else {
                        jsonString = messageFormatter.FormatMessage(err, "Access Denied, No admin permissions", false, undefined);
                        res.end(jsonString);
                    }
                }
            });
        }
    });
}

function GetUserMeta(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err ) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            if(users) {

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users.user_meta);
            }else{
                jsonString = messageFormatter.FormatMessage(undefined, "Get User Successful", true, undefined);

            }

        }

        res.end(jsonString);
    });








}

function GetAppMeta(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            if(users){

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users.app_meta);
            }
            else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User Failed", false, undefined);
            }


        }

        res.end(jsonString);
    });








}

function UpdateUserMetadata(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { "user_meta" : req.body }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update user meta Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update user meta Successful", true, undefined);

        }

        res.end(jsonString);
    });





}

function UpdateAppMetadata(req, res){



    logger.debug("DVP-UserService.UpdateUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant}, { "app_meta" : req.body }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update app meta Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update app meta Successful", true, undefined);

        }

        res.end(jsonString);
    });





}

function RemoveUserMetadata(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var metakey = req.params.usermeta;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ "user_meta" : {} }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove user meta Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove user meta successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function RemoveAppMetadata(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var metakey = req.params.appmeta;
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    User.findOneAndUpdate({username: req.params.name,company: company, tenant: tenant},{ "app_meta" : {} }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update app meta Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Update app meta successfully", false, undefined);

        }

        res.end(jsonString);


    });

}

function GetUserScopes(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User scope Failed", false, undefined);

        }else{

            if(users) {
                jsonString = messageFormatter.FormatMessage(err, "Get User scope Successful", true, users.user_scopes);
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User scope Failed", false, undefined);

            }

        }

        res.end(jsonString);
    });

}

function GetAppScopes(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    User.findOne({username: req.params.name,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {
                jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, users.client_scopes);
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function GetMyAppScopesByConsole(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var console = req.params.console;
    var jsonString;

    ////client_scopes:{$elemMatch: {consoleName: console}}


    User.findOne({username: user,company: company, tenant: tenant, }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {

                if(users.client_scopes) {

                    var obj = users.client_scopes.filter(function(obj, index){

                        return obj.consoleName == console;

                    });

                    if(obj) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, obj);
                    }else{

                        jsonString = messageFormatter.FormatMessage(err, "No Access found to "+ console, false, undefined);
                    }
                }
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function GetMyAppScopesByConsoles(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var consoles = req.query.consoles.split(",");
    var jsonString;

    ////client_scopes:{$elemMatch: {consoleName: console}}


    User.findOne({username: user,company: company, tenant: tenant, }, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {

                if(users.client_scopes) {
                    var consoleObjects = [];
                    for(var i =0; i< consoles.length; i++) {
                        var obj = users.client_scopes.filter(function (obj, index) {
                            return obj.consoleName == consoles[i];
                        });
                        if(obj && obj.length>0) {
                            consoleObjects.push(obj[0]);
                        }
                    }
                    if(consoleObjects) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, consoleObjects);
                    }else{

                        jsonString = messageFormatter.FormatMessage(err, "No Access found to "+ console, false, undefined);
                    }
                }
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function GetMyAppScopes(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;
    User.findOne({username: user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app scope Failed", false, undefined);

        }else{

            if(users) {
                jsonString = messageFormatter.FormatMessage(err, "Get User app scope Successful", true, users.client_scopes);
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app scope Failed", false, undefined);
            }

        }

        res.end(jsonString);
    });

}

function SetLocation(req, res){

    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.params.name;
    var jsonString;
    User.findOne({username: user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);
            res.end(jsonString);

        }else{

            if(users) {

                var id = util.format('location:%d:%d', tenant,company);

                try {

                    /*

                     geo.addLocation(id, {
                     latitude: req.body.latitude,
                     longitude: req.body.longitude
                     },
                     */

                    redisClient.geoadd(id,req.body.latitude, req.body.longitude,user, function (err, reply) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Set user location Failed", false, undefined);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Set user location successful", true, reply);

                        }
                        res.end(jsonString);
                    });
                }catch(exx){

                    jsonString = messageFormatter.FormatMessage(exx, "Set user location Failed", false, undefined);
                    res.end(jsonString);
                }

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User Failed", false, undefined);
                res.end(jsonString);
            }
        }

    });
}

function SetMyLocation(req, res){

    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;
    User.findOne({username: user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);
            res.end(jsonString);

        }else{

            if(users) {

                var id = util.format('location:%d:%d', tenant,company);

                try {

                    /*

                     geo.addLocation(id, {
                     latitude: req.body.latitude,
                     longitude: req.body.longitude
                     },
                     */

                    redisClient.geoadd(id,req.body.latitude, req.body.longitude,user, function (err, reply) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Set user location Failed", false, undefined);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Set user location successful", true, reply);

                        }
                        res.end(jsonString);
                    });
                }catch(exx){

                    jsonString = messageFormatter.FormatMessage(exx, "Set user location Failed", false, undefined);
                    res.end(jsonString);
                }

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User Failed", false, undefined);
                res.end(jsonString);
            }
        }

    });
}

function UpdateMyAppMetadata(req, res){



    logger.debug("DVP-UserService.UpdateMyAppMetadata Internal method ");


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;
    User.findOne({username: user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User app meta Failed", false, undefined);
            res.end(jsonString);

        }else{

            if(users) {


                if(users.app_meta){

                    Object.keys(req.body).forEach(function(key) {
                        var val = req.body[key];
                        users.app_meta[key] = val;
                    });

                    User.findOneAndUpdate({username: user,company: company, tenant: tenant},{app_meta: users.app_meta},function (err, user) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);

                        } else {
                            jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, users.app_meta);
                        }
                        res.end(jsonString);
                    });

                }else{

                    users.app_meta = req.body;

                    User.findOneAndUpdate({username: user,company: company, tenant: tenant},{app_meta: req.body},function (err, user) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);

                        } else {
                            jsonString = messageFormatter.FormatMessage(undefined, "User saved successfully", true, users.app_meta);
                        }
                        res.end(jsonString);
                    });
                }

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User app Meta Failed", false, undefined);
                res.end(jsonString);
            }

        }


    });

}

function GetMyAppMetadata(req, res){



    logger.debug("DVP-UserService.GetMyAppMetadata Internal method ");


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var user = req.user.iss;
    var jsonString;
    User.findOne({username: user,company: company, tenant: tenant}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

        }else{

            if(users){

                jsonString = messageFormatter.FormatMessage(err, "Get User Successful", true, users.app_meta);
            }
            else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get User Failed", false, undefined);
            }


        }

        res.end(jsonString);
    });


}

function CreateUserTag(req, res){

    logger.debug("DVP-UserService.CreateUserTag Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);


    var userTag= UserTag({
        company: parseInt(req.user.company),
        tenant: parseInt(req.user.tenant),
        name:req.body.name
    })

    userTag.save(function(errTag, resTag) {
        if (errTag) {
            jsonString = messageFormatter.FormatMessage(errTag, "UserTag save failed", false, undefined);
            res.end(jsonString);
        }else{
            jsonString = messageFormatter.FormatMessage(undefined, "UserTag save succeeded", true, resTag);
            res.end(jsonString);
        }
    });


}

function GetUserTag(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;



    UserTag.findOne({company: company, tenant: tenant,name:req.params.tag}).exec( function(errTag, userTags) {
        if (errTag) {

            jsonString = messageFormatter.FormatMessage(errTag, "Get UserTag Failed", false, undefined);
            res.end(jsonString);

        }
        else
        {

            jsonString = messageFormatter.FormatMessage(undefined, "Get UserTag Successful", true, userTags);
            res.end(jsonString);

        }


    });

}

function GetUserTags(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;



    UserTag.find({company: company, tenant: tenant}).exec( function(errTags, userTags) {
        if (errTags) {

            jsonString = messageFormatter.FormatMessage(errTags, "Get UserTags Failed", false, undefined);

        }
        else
        {

            jsonString = messageFormatter.FormatMessage(undefined, "Get UserTags Successful", true, userTags);

        }

        res.end(jsonString);
    });

}

function RemoveUserTag(req,res){


    logger.debug("DVP-UserService.RemoveUserTag Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    UserTag.findOneAndRemove({
        name: req.params.tag,
        company: company,
        tenant: tenant
    }, function (errRem, resRem) {
        if (errRem) {
            jsonString = messageFormatter.FormatMessage(errRem, "Remove User Tag Failed", false, undefined);
            res.end(jsonString);
        } else {

            jsonString = messageFormatter.FormatMessage(undefined, "Remove User Success", true, resRem);
            res.end(jsonString);
        }

    });

}

function GetSuperUsers(req, res){


    var tenant = parseInt(req.user.tenant);
    var jsonString;



    User.find({tenant: tenant, systemuser: true, Active: true, 'user_meta.role': 'superadmin'})
        .select("-password")
        .exec( function(err, users) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get SuperUsers Failed", false, undefined);

            }else {

                if (users) {

                    jsonString = messageFormatter.FormatMessage(err, "Get SuperUsers Successful", true, users);

                }else{

                    jsonString = messageFormatter.FormatMessage(undefined, "Get SuperUsers Failed", false, undefined);

                }
            }

            res.end(jsonString);
        });

}

function AddFileCategoryToUser(req, res){



    logger.debug("DVP-UserService.addFileCategoryToUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();

    DbConn.FileCategory.findOne({where:[{Category:req.params.category}]}).then(function (resCat) {

        if (resCat) {
            if (req.user.iss) {

                User.findOneAndUpdate({
                    username: req.user.iss,
                    company: company,
                    tenant: tenant
                }, {$push: {allowed_file_categories: req.params.category}}, function (err, users) {
                    if (err) {

                        jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);

                    } else {
                        if (users) {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Successful", true, users);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);
                        }


                    }

                    res.end(jsonString);
                });
            } else {

                jsonString = messageFormatter.FormatMessage(new Error('Add file category to User :- Username empty'), "Add file category to User :- Username empty", false, undefined);
                res.end(jsonString);

            }
        }
        else
        {
            jsonString = messageFormatter.FormatMessage(new Error('Invalid file category  : '+req.params.category), "Invalid file category "+req.params.category, false, undefined);
            res.end(jsonString);
        }

    }).catch(function (errCat) {
        jsonString = messageFormatter.FormatMessage(errCat, "Invalid file category "+req.params.category, false, undefined);
        res.end(jsonString);
    });




}


function AddFileCategoryToSpecificUser(req, res){



    logger.debug("DVP-UserService.addFileCategoryToUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();

    DbConn.FileCategory.findOne({where:[{Category:req.params.category}]}).then(function (resCat) {

        if (resCat) {
            if (req.user.iss) {

                User.findOneAndUpdate({
                    username: req.params.user,
                    company: company,
                    tenant: tenant
                }, {$push: {allowed_file_categories: req.params.category}}, function (err, users) {
                    if (err) {

                        jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);

                    } else {
                        if (users) {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Successful", true, users);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);
                        }


                    }

                    res.end(jsonString);
                });
            } else {

                jsonString = messageFormatter.FormatMessage(new Error('Add file category to User :- Username empty'), "Add file category to User :- Username empty", false, undefined);
                res.end(jsonString);

            }
        }
        else
        {
            jsonString = messageFormatter.FormatMessage(new Error('Invalid file category  : '+req.params.category), "Invalid file category "+req.params.category, false, undefined);
            res.end(jsonString);
        }

    }).catch(function (errCat) {
        jsonString = messageFormatter.FormatMessage(errCat, "Invalid file category "+req.params.category, false, undefined);
        res.end(jsonString);
    });




}

/*function AddFileCategoriesToUser(req, res){



 logger.debug("DVP-UserService.AddFileCategoriesToUser Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;

 req.body.updated_at = Date.now();

 var queryObj = {

 $or:[]
 }

 if(req.body.fileCategories)
 {
 req.body.fileCategories.forEach(function (item) {

 queryObj.$or.push({Category:item})
 });
 }


 DbConn.FileCategory.find(queryObj).then(function (resCat) {

 if (resCat) {


 var CategoryDetails = resCat.map(function (item) {

 return item.Category;

 });

 if (req.user.iss) {

 User.findOneAndUpdate({
 username: req.user.iss,
 company: company,
 tenant: tenant
 }, {$push: {allowed_file_categories: CategoryDetails}}, function (err, users) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Add file categories to User Failed", false, undefined);

 } else {
 if (users) {
 jsonString = messageFormatter.FormatMessage(err, "Add file categories to User Successful", true, users);
 }
 else {
 jsonString = messageFormatter.FormatMessage(err, "Add file categories to User Failed", false, undefined);
 }


 }

 res.end(jsonString);
 });
 } else {

 jsonString = messageFormatter.FormatMessage(new Error('Add file categories to User :- Username empty'), "Add file category to User :- Username empty", false, undefined);
 res.end(jsonString);

 }
 }
 else
 {
 jsonString = messageFormatter.FormatMessage(new Error('Invalid file categories  : '+req.body.fileCategories), "Invalid file category "+req.body.fileCategories, false, undefined);
 res.end(jsonString);
 }

 }).catch(function (errCat) {
 jsonString = messageFormatter.FormatMessage(errCat, "Invalid file categories "+req.body.fileCategories, false, undefined);
 res.end(jsonString);
 });




 }*/
function RemoveFileCategoryFromUser(req, res){



    logger.debug("DVP-UserService.addFileCategoryToUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();

    DbConn.FileCategory.findOne({where:[{Category:req.params.category}]}).then(function (resCat) {

        if (resCat) {
            if (req.user.iss) {

                User.findOneAndUpdate({
                    username: req.user.iss,
                    company: company,
                    tenant: tenant
                }, {$pull: {allowed_file_categories: req.params.category}}, function (err, users) {
                    if (err) {

                        jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);

                    } else {
                        if (users) {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Successful", true, users);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);
                        }


                    }

                    res.end(jsonString);
                });
            } else {

                jsonString = messageFormatter.FormatMessage(new Error('Add file category to User :- Username empty'), "Add file category to User :- Username empty", false, undefined);
                res.end(jsonString);

            }
        }
        else
        {
            jsonString = messageFormatter.FormatMessage(new Error('Invalid file category  : '+req.params.category), "Invalid file category "+req.params.category, false, undefined);
            res.end(jsonString);
        }

    }).catch(function (errCat) {
        jsonString = messageFormatter.FormatMessage(errCat, "Invalid file category "+req.params.category, false, undefined);
        res.end(jsonString);
    });




}

function RemoveFileCategoryFromSpecificUser(req, res){



    logger.debug("DVP-UserService.addFileCategoryToUser Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();

    DbConn.FileCategory.findOne({where:[{Category:req.params.category}]}).then(function (resCat) {

        if (resCat) {
            if (req.user.iss) {

                User.findOneAndUpdate({
                    username: req.params.user,
                    company: company,
                    tenant: tenant
                }, {$pull: {allowed_file_categories: req.params.category}}, function (err, users) {
                    if (err) {

                        jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);

                    } else {
                        if (users) {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Successful", true, users);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(err, "Add file category to User Failed", false, undefined);
                        }


                    }

                    res.end(jsonString);
                });
            } else {

                jsonString = messageFormatter.FormatMessage(new Error('Add file category to User :- Username empty'), "Add file category to User :- Username empty", false, undefined);
                res.end(jsonString);

            }
        }
        else
        {
            jsonString = messageFormatter.FormatMessage(new Error('Invalid file category  : '+req.params.category), "Invalid file category "+req.params.category, false, undefined);
            res.end(jsonString);
        }

    }).catch(function (errCat) {
        jsonString = messageFormatter.FormatMessage(errCat, "Invalid file category "+req.params.category, false, undefined);
        res.end(jsonString);
    });




}



//----------------------------ActiveDirectory------------------------------------

function CreateUserFromAD(req, res){

    logger.debug("DVP-UserService.CreateUserFromAD Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(org){
                if(req.body.role && req.body.username){
                    var userRole = req.body.role.toLowerCase();
                    var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", userRole);
                    if(limitObj){
                        if(limitObj.accessLimit > limitObj.currentAccess.length){

                            User.findOne({tenant: tenant, company: company, username: req.body.username}, function(err, existingUser) {
                                if(err){
                                    jsonString = messageFormatter.FormatMessage(err, "Error on find existing user", false, undefined);
                                    res.end(jsonString);
                                }

                                if(!existingUser){
                                    if(!req.body.address)
                                    {
                                        req.body.address = {};
                                    }

                                    var user = User({
                                        systemuser: true,
                                        title: req.body.title,
                                        name: req.body.name,
                                        avatar: req.body.avatar,
                                        birthday: req.body.birthday,
                                        Active: true,
                                        gender: req.body.gender,
                                        firstname: req.body.firstname,
                                        lastname: req.body.lastname,
                                        locale: req.body.locale,
                                        ssn: req.body.ssn,
                                        address:{
                                            zipcode: req.body.address.zipcode,
                                            number: req.body.address.number,
                                            street: req.body.address.street,
                                            city: req.body.address.city,
                                            province: req.body.address.province,
                                            country: req.body.address.country


                                        },
                                        username: req.body.username,
                                        password: req.body.password,
                                        email:{contact:req.body.mail, type: "phone", verified: false},
                                        company: parseInt(req.user.company),
                                        tenant: parseInt(req.user.tenant),
                                        user_meta: {role: userRole},
                                        auth_mechanism: "ad",
                                        verified: true,
                                        created_at: Date.now(),
                                        updated_at: Date.now()
                                    });

                                    user.save(function(err, user) {
                                        if (err) {
                                            jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
                                            res.end(jsonString);
                                        }else{

                                            limitObj.currentAccess.push(user.username);
                                            Org.findOneAndUpdate({id: company, tenant: tenant},org, function(err, rOrg) {
                                                if (err) {
                                                    user.remove(function (err) {});
                                                    jsonString = messageFormatter.FormatMessage(err, "Update Limit Failed, Rollback User Creation", false, undefined);
                                                }else{



                                                    jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                    res.end(jsonString);

                                                }

                                            });
                                        }
                                    });
                                }else{
                                    jsonString = messageFormatter.FormatMessage(err, "User already in deactivate state", false, undefined);
                                    res.end(jsonString);
                                }

                            });

                        }else{
                            jsonString = messageFormatter.FormatMessage(err, "User Limit Exceeded", false, undefined);
                            res.end(jsonString);
                        }
                    }else{
                        jsonString = messageFormatter.FormatMessage(err, "Invalid User Role", false, undefined);
                        res.end(jsonString);
                    }
                }else{
                    jsonString = messageFormatter.FormatMessage(err, "No User Role Found", false, undefined);
                    res.end(jsonString);
                }
            }else{
                jsonString = messageFormatter.FormatMessage(err, "Organisation Data NotFound", false, undefined);
                res.end(jsonString);
            }
        }
    });
}




module.exports.GetUser = GetUser;
module.exports.GetUsers = GetUsers;
module.exports.GetUsersByRole = GetUsersByRole;
module.exports.GetUsersByRoles = GetUsersByRoles;
module.exports.GetUsersByIDs = GetUsersByIDs;
module.exports.DeleteUser = DeleteUser;
module.exports.CreateUser = CreateUser;
module.exports.ReActivateUser = ReActivateUser;
module.exports.UpdateUser = UpdateUser;
module.exports.GetUserProfile = GetUserProfile;
module.exports.GetUserProfileByContact = GetUserProfileByContact;
module.exports.UpdateUserProfile = UpdateUserProfile;
module.exports.AddUserScopes = AddUserScopes;
module.exports.RemoveUserScopes = RemoveUserScopes;
module.exports.AddUserAppScopes = AddUserAppScopes;
module.exports.RemoveUserAppScopes =RemoveUserAppScopes;
module.exports.GetUserMeta =GetUserMeta;
module.exports.GetAppMeta =GetAppMeta;
module.exports.UpdateUserMetadata = UpdateUserMetadata;
module.exports.UpdateAppMetadata = UpdateAppMetadata;
module.exports.GetUserScopes = GetUserScopes;
module.exports.GetAppScopes = GetAppScopes;
module.exports.RemoveUserMetadata = RemoveUserMetadata;
module.exports.RemoveAppMetadata= RemoveAppMetadata;
module.exports.UpdateUserProfileEmail = UpdateUserProfileEmail;
module.exports.UpdateUserProfilePhone = UpdateUserProfilePhone;
module.exports.UpdateUserProfileContact = UpdateUserProfileContact;
module.exports.RemoveUserProfileContact = RemoveUserProfileContact;


module.exports.GetMyrProfile = GetMyrProfile;
module.exports.UpdateMyUser = UpdateMyUser;
module.exports.UpdateMyPassword = UpdateMyPassword;
module.exports.UpdateMyUserProfile = UpdateMyUserProfile;
module.exports.UpdateMyUserProfileContact = UpdateMyUserProfileContact;
module.exports.RemoveMyUserProfileContact =RemoveMyUserProfileContact;
module.exports.GetExternalUsers = GetExternalUsers;

module.exports.SetUserProfileResourceId = SetUserProfileResourceId;
module.exports.GetUserProfileByResourceId = GetUserProfileByResourceId;
module.exports.GetARDSFriendlyContactObject = GetARDSFriendlyContactObject;
module.exports.UserExists = UserExists;
module.exports.AssignConsoleToUser = AssignConsoleToUser;
module.exports.RemoveConsoleFromUser = RemoveConsoleFromUser;
module.exports.CreateExternalUser =CreateExternalUser;
module.exports.GetMyAppScopes = GetMyAppScopes;


module.exports.GetMyAppScopesByConsole = GetMyAppScopesByConsole;
module.exports.GetMyAppScopesByConsoles = GetMyAppScopesByConsoles;
module.exports.GetMyARDSFriendlyContactObject = GetMyARDSFriendlyContactObject;
module.exports.OwnerExists = OwnerExists;

module.exports.SetLocation = SetLocation;
module.exports.SetMyLocation = SetMyLocation;


module.exports.CreateUserTag = CreateUserTag;
module.exports.GetUserTags = GetUserTags;
module.exports.RemoveUserTag = RemoveUserTag;
module.exports.GetUserTag = GetUserTag;

module.exports.UpdateMyAppMetadata = UpdateMyAppMetadata;
module.exports.GetMyAppMetadata = GetMyAppMetadata;
module.exports.UpdateUserProfilePassword = UpdateUserProfilePassword;

module.exports.GetSuperUsers = GetSuperUsers;


module.exports.AddFileCategoryToUser = AddFileCategoryToUser;
module.exports.AddFileCategoryToSpecificUser = AddFileCategoryToSpecificUser;
module.exports.RemoveFileCategoryFromUser = RemoveFileCategoryFromUser;
module.exports.RemoveFileCategoryFromSpecificUser = RemoveFileCategoryFromSpecificUser;

module.exports.CreateUserFromAD = CreateUserFromAD;
/*
 module.exports.AddFileCategoriesToUser = AddFileCategoriesToUser;*/
