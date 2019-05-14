/**
 * Created by Sukitha on 10/18/2016.
 */

var User = require('dvp-mongomodels/model/User');
var UserAccount = require('dvp-mongomodels/model/UserAccount');
var jwt = require('jsonwebtoken');
var redis = require('ioredis');
var accessToken = require ('dvp-mongomodels/model/AccessToken');
var config = require('config');
var request = require('request');
var uuid = require('node-uuid');
var moment = require('moment');
var Tenant = require('dvp-mongomodels/model/Tenant').Tenant;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var Org = require('dvp-mongomodels/model/Organisation');
var orgService = require('./OrganisationService');
var bcrypt = require('bcryptjs');
var qs = require('querystring');
var PublishToQueue = require('./Worker').PublishToQueue;
var util = require('util');
var crypto = require('crypto');
var accessToken = require ('dvp-mongomodels/model/AccessToken');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var crypto = require('crypto');
var Console = require('dvp-mongomodels/model/Console');
var ADService = require('./ActiveDirectoryService');


var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redispass = config.Redis.password;
var redismode = config.Redis.mode;
var redisdb = config.Redis.db;

/////////////////security breach///////////////////////
var commonsignature = config.auth.common_signature;

var multilogin = config.auth.multi_login;



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

    if(config.Redis.sentinels && config.Redis.sentinels.hosts && config.Redis.sentinels.port && config.Redis.sentinels.name){
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


function FilterObjFromArray(itemArray, field, value) {
    var resultObj;
    for (var i in itemArray) {
        var item = itemArray[i];
        if (item[field] == value) {
            resultObj = item;
            break;
        }
    }
    return resultObj;
}

function GetVerification(token, done) {

    var payload = jwt.decode(token);

    if(commonsignature === true || commonsignature === "true"){

        if (jwt.verify(token, payload.jti)) {
            return done(null, payload);
        } else {
            return done(new Error('verification_failed'));
        }

    }else {

        if (payload && payload.iss && payload.jti) {

            redisClient.get("token:iss:" + payload.iss + ":" + payload.jti, function (err, key) {
                if (err) {
                    return done(err);
                }
                if (!key) {
                    return done(new Error('missing_secret'));
                }

                if (jwt.verify(token, key)) {
                    return done(null, payload);
                } else {
                    return done(new Error('verification_failed'));
                }


            });
        } else {

            return done(new Error('wrong_token'));
        }
    }
}

function GetScopes(user, claims){


    var context = {};
    var payload = {};
    payload.context = {};
    payload.scope = [];

    if(claims) {
        var index = claims.indexOf("profile_contacts");

        if (index > -1) {
            payload.context.phonenumber = user.phoneNumber;
            payload.context.email = user.email;
            payload.context.othercontacts = user.contacts;

            claims.splice(index, 1);
        }


        var index = claims.indexOf("app_meta");

        if (index > -1) {
            payload.context.appmeta = user.app_meta;
            claims.splice(index, 1);
        }


        var index = claims.indexOf("user_scopes");

        if (index > -1) {
            payload.context.userscopes = user.user_scopes;
            claims.splice(index, 1);
        }

        var index = claims.indexOf("client_scopes");

        if (index > -1) {
            payload.context.clientscopes = user.client_scopes;
            claims.splice(index, 1);
        }


        var index = claims.indexOf("resourceid");

        if (index > -1) {
            payload.context.resourceid = user.resourceid;
            claims.splice(index, 1);
        }


        var profileClaimsFound = claims.filter(function (item, index) {

            return item.startsWith('profile_');
        })

        profileClaimsFound.forEach(function (value) {


            var arr = value.split("_");
            if (arr.length > 1) {

                var action = arr[0];
                var resource = arr[1];

                if(action == "profile"){


                    if(resource == "password"){

                        payload.context[resource] = undefined;


                    }
                    else{

                        payload.context[resource] = user[resource];

                    }

                }

            }});


        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        var index = claims.indexOf("all_all");

        if (index > -1) {
            user.user_scopes.forEach(function (item){
                var actionObj = {};
                actionObj.resource = item.scope;
                actionObj.actions = [];

                if(item.read){
                    actionObj.actions.push("read");
                }

                if(item.write){

                    actionObj.actions.push("write");
                }

                if(item.delete){

                    actionObj.actions.push("delete");
                }
                payload.scope.push(actionObj);
            });

        }else {

            claims.forEach(function (value) {


                var arr = value.split("_");
                if (arr.length > 1) {

                    var action = arr[0];
                    var resource = arr[1];


                    var scopeFound = user.user_scopes.filter(function (item) {
                        return item.scope == resource;
                    })


                    if (scopeFound.length > 0) {

                        var myscope = {};
                        myscope.resource = scopeFound[0].scope;
                        myscope.actions = [];

                        if (action == "read") {

                            var actionArray = [];
                            if (scopeFound[0].read) {

                                actionArray.push("read");

                            }

                            myscope.actions = myscope.actions.concat(actionArray);


                        }
                        else if (action == "write") {


                            var actionArray = [];
                            if (scopeFound[0].read) {

                                actionArray.push("read");

                            }

                            if (scopeFound[0].write) {

                                actionArray.push("write");

                            }


                            myscope.actions = myscope.actions.concat(actionArray);

                        }
                        else if (action == "all") {


                            var actionArray = [];
                            if (scopeFound[0].read) {

                                actionArray.push("read");

                            }

                            if (scopeFound[0].write) {

                                actionArray.push("write");

                            }


                            if (scopeFound[0].delete) {

                                actionArray.push("delete");

                            }

                            myscope.actions = myscope.actions.concat(actionArray);

                        }

                        payload.scope.push(myscope);
                    }


                }
            });
        }
    }


    return payload;

}

function GetJWT(user, scopesx, client_id, type, req, done){

    var jti = uuid.v4();
    var secret = uuid.v4();
    var expin  = moment().add(7, 'days').unix();
    var redisKey = "token:iss:"+user.username+":"+jti;
    var tokenMap = "token:iss:"+user.username+":*";

    if(commonsignature === true || commonsignature === "true"){

        var payload = {};

        secret = jti;
        payload.iss = user.username;
        payload.jti = jti;
        payload.sub = "Access client";
        payload.exp = expin;
        payload.tenant = user.tenant;
        payload.company = user.company;
        //payload.aud = client.name;

        if (user.companyName)
            payload.companyName = user.companyName;

        var scopes = GetScopes(user, scopesx);
        payload.context = scopes.context;
        payload.scope = scopes.scope;
        var token = jwt.sign(payload, secret);

        var accesstoken = accessToken({

            userId: user._id,
            clientId: client_id,
            jti: jti,
            Agent: req.headers['user-agent'],
            Location: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            scope: scopesx,
            expirationDate: expin,
            type: type
        });

        accesstoken.save(function (err, accesstoken) {
            if (err) {

                return done(err, false, undefined);
            }
            return done(undefined, true, token);
        });

    }else {

//multilogin
        if ((multilogin ===false || multilogin === "false") || (user.multi_login != undefined && user.multi_login === false)) {

            redisClient.keys(tokenMap, function (err, res) {

                if (Array.isArray(res)) {
                    res.forEach(function (item) {
                        //var delRedisKey = "token:iss:"+user.username+":"+item;
                        redisClient.del(item, function (err, res) {
                            logger.info("JTI deleted -> ", item);
                        })
                    })
                }

                redisClient.set(redisKey, secret, function (err, res) {

                    if (!err) {
                        redisClient.expireat(redisKey, expin);

                        var payload = {};
                        payload.iss = user.username;
                        payload.jti = jti;
                        payload.sub = "Access client";
                        payload.exp = expin;
                        payload.tenant = user.tenant;
                        payload.company = user.company;

                        if (user.companyName)
                            payload.companyName = user.companyName;
                        //payload.aud = client.name;

                        var scopes = GetScopes(user, scopesx);
                        payload.context = scopes.context;
                        payload.scope = scopes.scope;
                        var token = jwt.sign(payload, secret);


                        var accesstoken = accessToken({

                            userId: user._id,
                            clientId: client_id,
                            jti: jti,
                            Agent: req.headers['user-agent'],
                            Location: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                            scope: scopesx,
                            expirationDate: expin,
                            type: type
                        });

                        accesstoken.save(function (err, accesstoken) {
                            if (err) {

                                return done(err, false, undefined);
                            }
                            return done(undefined, true, token);
                        });
                    } else {

                        return done(err, false, undefined);
                    }

                });

            });
        } else {

            redisClient.set(redisKey, secret, function (err, res) {

                if (!err) {


                    redisClient.expireat(redisKey, expin);

                    var payload = {};
                    payload.iss = user.username;
                    payload.jti = jti;
                    payload.sub = "Access client";
                    payload.exp = expin;
                    payload.tenant = user.tenant;
                    payload.company = user.company;
                    //payload.aud = client.name;

                    if (user.companyName)
                        payload.companyName = user.companyName;

                    var scopes = GetScopes(user, scopesx);
                    payload.context = scopes.context;
                    payload.scope = scopes.scope;
                    var token = jwt.sign(payload, secret);


                    var accesstoken = accessToken({


                        userId: user._id,
                        clientId: client_id,
                        jti: jti,
                        Agent: req.headers['user-agent'],
                        Location: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        scope: scopesx,
                        expirationDate: expin,
                        type: type
                    });

                    accesstoken.save(function (err, accesstoken) {
                        if (err) {

                            return done(err, false, undefined);
                        }
                        return done(undefined, true, token);
                    });
                } else {

                    return done(err, false, undefined);
                }

            });
        }
    }
}

function Encrypt(plainText, workingKey) {

    var key =workingKey;
    var iv = '0123456789@#$%&*';
    var cipher = crypto.createCipheriv('aes-128-ctr', key, iv);
    var encoded = cipher.update(plainText, 'utf8', 'hex');
    encoded += cipher.final('hex');
    return encoded;
}


module.exports.Login =  function(req, res) {
    //email.contact
    User.findOne({"username": req.body.userName}, '+password', function (err, user) {
        if (!user) {
            return res.status(401).send({message: 'Invalid email and/or password'});
        }

        if (user && !user.Active) {
            return res.status(401).send({message: 'User account deactivated, Please activate your account before login'});
        }

        //var companyReg = ["^",req.body.companyName,"$"].join('');
        //Org.findOne({"companyName": {$regex: companyReg, $options: "i"}}, function (err, org) {
        Org.findOne({"companyName": req.body.companyName}, function (err, org) {
            if(err){
                return res.status(401).send({message: 'Company verification failed'});
            }

            if(!org){
                return res.status(401).send({message: 'Invalid organization name'});
            }

            if (org && org.companyEnabled) {
                UserAccount.findOne({"tenant": org.tenant, "company": org.id, "user": user.username}, function (err, account) {
                    if (err) {
                        return res.status(401).send({message: 'User account verification failed'});
                    }
                    if (!account ) {
                        return res.status(401).send({message: 'Invalid user account'});
                    }

                    if((config.auth.login_verification === true || config.auth.login_verification === 'true') && account.verified != true ){
                        return res.status(401).send({message: 'User account is not verified'});
                    }

                    if( account.active != true ){
                        return res.status(401).send({message: 'User account is not active'});
                    }


                    //user = user.toObject();
                    user._doc.tenant = org.tenant;
                    user._doc.company = org.id;
                    user.companyName = org.companyName;
                    user._doc.multi_login = account.multi_login;
                    user._doc.user_meta = account.user_meta;
                    user._doc.app_meta = account.app_meta;
                    user._doc.user_scopes = account.user_scopes;
                    user._doc.client_scopes = account.client_scopes;
                    user._doc.resourceid = account.resource_id;
                    user._doc.veeryaccount = account.veeryaccount;
                    user._doc.multi_login = account.multi_login;


                    logger.info("config.auth.login_verification --> " + config.auth.login_verification + (config.auth.login_verification === true) + " user.verified --->"+ user.verified + (user.verified === false)+ " result -->" + ((config.auth.login_verification == true) && (user.verified == false)));

                    if ((config.auth.login_verification === true || config.auth.login_verification === 'true') && (user.verified === false)) {

                        //res.status(449 ).send({message: 'Activate your account before login'});
                        crypto.randomBytes(20, function (err, buf) {
                            var token = buf.toString('hex');

                            ////////////////////hosted location from config////////////////////
                            var url = config.auth.ui_host + '#/activate/' + token;

                            redisClient.set("activate"+":"+token,user._id ,function (err, val) {
                                if (err) {

                                    res.status(404).send({message: 'Create activation token failed'});

                                }else{

                                    redisClient.expireat("activate"+":"+token,  parseInt((+new Date)/1000) + 86400);
                                    var sendObj = {
                                        "company": config.Tenant.activeCompany,
                                        "tenant": config.Tenant.activeTenant
                                    };

                                    sendObj.to =  user.email.contact;
                                    sendObj.from = "no-reply";
                                    sendObj.template = "By-User Registration Confirmation";
                                    sendObj.Parameters = {username: user.username,
                                        created_at: new Date(),
                                        url:url}

                                    PublishToQueue("EMAILOUT", sendObj)
                                    return res.status(449 ).send({message: 'Activate your account before login'});
                                }
                            });

                        });
                    }else {


                        /*bcrypt.compare(req.body.password, user.password, function(err, isMatch) {
                         if (!isMatch) {
                         return res.status(401).send({message: 'Invalid email and/or password'});
                         }
                         res.send({token: GetJWT(user, ["all_all"])});
                         });*/

                        if(user.auth_mechanism && user.auth_mechanism === 'ad'){

                            ADService.AuthenticateUser(user.tenant, user.company, req.body.userName, req.body.password, function (err, auth) {
                                if (err) {
                                    return res.status(401).send({message: err.message});
                                }

                                var claims_arr = ["all_all"];
                                if (req.body.scope && util.isArray(req.body.scope) && req.body.scope.length > 0) {

                                    claims_arr = req.body.scope;
                                }


                                //Org.findOne({tenant: user.tenant, id: user.company}, function (err, org) {
                                //if (err) {

                                //return res.status(449).send({message: 'Activate your organization before login'});

                                //} else {

                                //if (org && org.companyEnabled) {


                                Console.findOne({consoleName: req.body.console}, function (err, console) {
                                    if (err) {
                                        return res.status(449).send({message: 'Request console is not valid ...'});
                                    } else {

                                        if (!console) {

                                            return res.status(449).send({message: 'Request console is not valid ...'});
                                        } else {


                                            if (console.consoleName == "OPERATOR_CONSOLE") {


                                                var bill_token_key = config.Tenant.activeTenant + "_BILL_TOKEN";
                                                var Hash_token_key = config.Tenant.activeTenant + "_BILL_HASH_TOKEN";


                                                logger.info("The bill token key is " + bill_token_key);
                                                logger.info("The hash token key is " + Hash_token_key);


                                                redisClient.get(bill_token_key, function (err, reply) {

                                                    if (!err && reply) {

                                                        var bill_token = reply;

                                                        logger.debug("The bill token is " + reply)


                                                        redisClient.get(Hash_token_key, function (err, reply) {

                                                            if (!err && reply) {


                                                                var hash_token = reply;

                                                                logger.debug("The hash token is " + reply)

                                                                if (bill_token == Encrypt(hash_token, 'DuoS123412341234')) {

                                                                    if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                                        GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                                            if (token) {
                                                                                return res.send({
                                                                                    state: 'login',
                                                                                    token: token
                                                                                });
                                                                            } else {
                                                                                return res.status(401).send({message: 'Invalid email and/or password'});
                                                                            }
                                                                        });
                                                                    } else {

                                                                        return res.status(449).send({message: 'User console request is invalid'});
                                                                    }

                                                                } else {

                                                                    return res.status(449).send({message: 'Bill token is not match'});
                                                                }

                                                            } else {

                                                                logger.error("Hash token failed", err);
                                                                return res.status(449).send({message: 'Hash token is not found'});
                                                            }
                                                        });
                                                    } else {

                                                        logger.error("Bill token failed ", err);
                                                        return res.status(449).send({message: 'Bill token is not found'});
                                                    }
                                                });


                                            } else {

                                                if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                    GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                        if (token) {
                                                            return res.send({state: 'login', token: token});
                                                        } else {
                                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                                        }
                                                    });
                                                } else {

                                                    return res.status(449).send({message: 'User console request is invalid'});
                                                }

                                            }


                                        }
                                    }
                                });

                                //} else {

                                //return res.status(449).send({message: 'Activate your organization before login'});
                                //}
                                //}

                                //});
                            });
                        }else
                        {

                            user.comparePassword(req.body.password, function (err, isMatch) {
                                if (!isMatch) {
                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                }

                                var claims_arr = ["all_all"];
                                if (req.body.scope && util.isArray(req.body.scope) && req.body.scope.length > 0) {

                                    claims_arr = req.body.scope;
                                }


                                //Org.findOne({tenant: user.tenant, id: user.company}, function (err, org) {
                                //if (err) {

                                //return res.status(449).send({message: 'Activate your organization before login'});

                                //} else {

                                //if (org && org.companyEnabled) {


                                Console.findOne({consoleName: req.body.console}, function (err, console) {
                                    if (err) {
                                        return res.status(449).send({message: 'Request console is not valid ...'});
                                    } else {

                                        if (!console) {

                                            return res.status(449).send({message: 'Request console is not valid ...'});
                                        } else {


                                            if (console.consoleName == "OPERATOR_CONSOLE") {


                                                var bill_token_key = config.Tenant.activeTenant + "_BILL_TOKEN";
                                                var Hash_token_key = config.Tenant.activeTenant + "_BILL_HASH_TOKEN";


                                                logger.info("The bill token key is " + bill_token_key);
                                                logger.info("The hash token key is " + Hash_token_key);


                                                redisClient.get(bill_token_key, function (err, reply) {

                                                    if (!err && reply) {

                                                        var bill_token = reply;

                                                        logger.debug("The bill token is " + reply)


                                                        redisClient.get(Hash_token_key, function (err, reply) {

                                                            if (!err && reply) {


                                                                var hash_token = reply;

                                                                logger.debug("The hash token is " + reply)

                                                                if (bill_token == Encrypt(hash_token, 'DuoS123412341234')) {

                                                                    if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                                        GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                                            if (token) {
                                                                                return res.send({
                                                                                    state: 'login',
                                                                                    token: token
                                                                                });
                                                                            } else {
                                                                                return res.status(401).send({message: 'Invalid email and/or password'});
                                                                            }
                                                                        });
                                                                    } else {

                                                                        return res.status(449).send({message: 'User console request is invalid'});
                                                                    }

                                                                } else {

                                                                    return res.status(449).send({message: 'Bill token is not match'});
                                                                }

                                                            } else {

                                                                logger.error("Hash token failed", err);
                                                                return res.status(449).send({message: 'Hash token is not found'});
                                                            }
                                                        });
                                                    } else {

                                                        logger.error("Bill token failed ", err);
                                                        return res.status(449).send({message: 'Bill token is not found'});
                                                    }
                                                });


                                            } else {

                                                if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                    GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                        if (token) {
                                                            return res.send({state: 'login', token: token});
                                                        } else {
                                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                                        }
                                                    });
                                                } else {

                                                    return res.status(449).send({message: 'User console request is invalid'});
                                                }

                                            }


                                        }
                                    }
                                });

                                //} else {

                                //return res.status(449).send({message: 'Activate your organization before login'});
                                //}
                                //}

                                //});
                            });
                        }
                    }

                });
            }else {
                return res.status(449).send({message: 'Activate your organization before login'});
            }
        });

    });
};

module.exports.LoginTest =  function(req, res) {
    //email.contact
    User.findOne({"username": req.body.userName}, '+password', function (err, user) {
        if (!user) {
            return res.status(401).send({message: 'Invalid email and/or password'});
        }

        if (user && !user.Active) {
            return res.status(401).send({message: 'User account deactivated, Please activate your account before login'});
        }

        var companyReg = ["^",req.body.companyName,"$"].join('');
        Org.findOne({"companyName": {$regex: companyReg, $options: "i"}}, function (err, org) {
            if(err){
                return res.status(401).send({message: 'Company verification failed'});
            }

            if(!org){
                return res.status(401).send({message: 'Invalid organization name'});
            }

            if (org && org.companyEnabled) {
                UserAccount.findOne({"tenant": org.tenant, "company": org.id, "user": user.username}, function (err, account) {
                    if (err) {
                        return res.status(401).send({message: 'User account verification failed'});
                    }
                    if (!account ) {
                        return res.status(401).send({message: 'Invalid user account'});
                    }

                    if((config.auth.login_verification === true || config.auth.login_verification === 'true') && account.verified != true ){
                        return res.status(401).send({message: 'User account is not verified'});
                    }

                    if( account.active != true ){
                        return res.status(401).send({message: 'User account is not active'});
                    }


                    //user = user.toObject();
                    user._doc.tenant = org.tenant;
                    user._doc.company = org.id;
                    user.companyName = org.companyName;
                    user._doc.multi_login = account.multi_login;
                    user._doc.user_meta = account.user_meta;
                    user._doc.app_meta = account.app_meta;
                    user._doc.user_scopes = account.user_scopes;
                    user._doc.client_scopes = account.client_scopes;
                    user._doc.resourceid = account.resource_id;
                    user._doc.veeryaccount = account.veeryaccount;
                    user._doc.multi_login = account.multi_login;


                    logger.info("config.auth.login_verification --> " + config.auth.login_verification + (config.auth.login_verification === true) + " user.verified --->"+ user.verified + (user.verified === false)+ " result -->" + ((config.auth.login_verification == true) && (user.verified == false)));

                    if ((config.auth.login_verification === true || config.auth.login_verification === 'true') && (user.verified === false)) {

                        //res.status(449 ).send({message: 'Activate your account before login'});
                        crypto.randomBytes(20, function (err, buf) {
                            var token = buf.toString('hex');

                            ////////////////////hosted location from config////////////////////
                            var url = config.auth.ui_host + '#/activate/' + token;

                            redisClient.set("activate"+":"+token,user._id ,function (err, val) {
                                if (err) {

                                    res.status(404).send({message: 'Create activation token failed'});

                                }else{

                                    redisClient.expireat("activate"+":"+token,  parseInt((+new Date)/1000) + 86400);
                                    var sendObj = {
                                        "company": config.Tenant.activeCompany,
                                        "tenant": config.Tenant.activeTenant
                                    };

                                    sendObj.to =  user.email.contact;
                                    sendObj.from = "no-reply";
                                    sendObj.template = "By-User Registration Confirmation";
                                    sendObj.Parameters = {username: user.username,
                                        created_at: new Date(),
                                        url:url}

                                    PublishToQueue("EMAILOUT", sendObj)
                                    return res.status(449 ).send({message: 'Activate your account before login'});
                                }
                            });

                        });
                    }else {


                        /*bcrypt.compare(req.body.password, user.password, function(err, isMatch) {
                         if (!isMatch) {
                         return res.status(401).send({message: 'Invalid email and/or password'});
                         }
                         res.send({token: GetJWT(user, ["all_all"])});
                         });*/

                        if(user.auth_mechanism && user.auth_mechanism === 'ad'){

                            ADService.AuthenticateUser(user.tenant, user.company, req.body.userName, req.body.password, function (err, auth) {
                                if (err) {
                                    return res.status(401).send({message: err.message});
                                }

                                var claims_arr = ["all_all"];
                                if (req.body.scope && util.isArray(req.body.scope) && req.body.scope.length > 0) {

                                    claims_arr = req.body.scope;
                                }


                                //Org.findOne({tenant: user.tenant, id: user.company}, function (err, org) {
                                //if (err) {

                                //return res.status(449).send({message: 'Activate your organization before login'});

                                //} else {

                                //if (org && org.companyEnabled) {


                                Console.findOne({consoleName: req.body.console}, function (err, console) {
                                    if (err) {
                                        return res.status(449).send({message: 'Request console is not valid ...'});
                                    } else {

                                        if (!console) {

                                            return res.status(449).send({message: 'Request console is not valid ...'});
                                        } else {


                                            if (console.consoleName == "OPERATOR_CONSOLE") {


                                                var bill_token_key = config.Tenant.activeTenant + "_BILL_TOKEN";
                                                var Hash_token_key = config.Tenant.activeTenant + "_BILL_HASH_TOKEN";


                                                logger.info("The bill token key is " + bill_token_key);
                                                logger.info("The hash token key is " + Hash_token_key);


                                                redisClient.get(bill_token_key, function (err, reply) {

                                                    if (!err && reply) {

                                                        var bill_token = reply;

                                                        logger.debug("The bill token is " + reply)


                                                        redisClient.get(Hash_token_key, function (err, reply) {

                                                            if (!err && reply) {


                                                                var hash_token = reply;

                                                                logger.debug("The hash token is " + reply)

                                                                if (bill_token == Encrypt(hash_token, 'DuoS123412341234')) {

                                                                    if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                                        GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                                            if (token) {
                                                                                return res.send("dsdsds");
                                                                            } else {
                                                                                return res.status(401).send({message: 'Invalid email and/or password'});
                                                                            }
                                                                        });
                                                                    } else {

                                                                        return res.status(449).send({message: 'User console request is invalid'});
                                                                    }

                                                                } else {

                                                                    return res.status(449).send({message: 'Bill token is not match'});
                                                                }

                                                            } else {

                                                                logger.error("Hash token failed", err);
                                                                return res.status(449).send({message: 'Hash token is not found'});
                                                            }
                                                        });
                                                    } else {

                                                        logger.error("Bill token failed ", err);
                                                        return res.status(449).send({message: 'Bill token is not found'});
                                                    }
                                                });


                                            } else {

                                                if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                    GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                        if (token) {
                                                            return res.send("dsdsds");
                                                        } else {
                                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                                        }
                                                    });
                                                } else {

                                                    return res.status(449).send({message: 'User console request is invalid'});
                                                }

                                            }


                                        }
                                    }
                                });

                                //} else {

                                //return res.status(449).send({message: 'Activate your organization before login'});
                                //}
                                //}

                                //});
                            });
                        }else
                        {

                            user.comparePassword(req.body.password, function (err, isMatch) {
                                if (!isMatch) {
                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                }

                                var claims_arr = ["all_all"];
                                if (req.body.scope && util.isArray(req.body.scope) && req.body.scope.length > 0) {

                                    claims_arr = req.body.scope;
                                }


                                //Org.findOne({tenant: user.tenant, id: user.company}, function (err, org) {
                                //if (err) {

                                //return res.status(449).send({message: 'Activate your organization before login'});

                                //} else {

                                //if (org && org.companyEnabled) {


                                Console.findOne({consoleName: req.body.console}, function (err, console) {
                                    if (err) {
                                        return res.status(449).send({message: 'Request console is not valid ...'});
                                    } else {

                                        if (!console) {

                                            return res.status(449).send({message: 'Request console is not valid ...'});
                                        } else {


                                            if (console.consoleName == "OPERATOR_CONSOLE") {


                                                var bill_token_key = config.Tenant.activeTenant + "_BILL_TOKEN";
                                                var Hash_token_key = config.Tenant.activeTenant + "_BILL_HASH_TOKEN";


                                                logger.info("The bill token key is " + bill_token_key);
                                                logger.info("The hash token key is " + Hash_token_key);


                                                redisClient.get(bill_token_key, function (err, reply) {

                                                    if (!err && reply) {

                                                        var bill_token = reply;

                                                        logger.debug("The bill token is " + reply)


                                                        redisClient.get(Hash_token_key, function (err, reply) {

                                                            if (!err && reply) {


                                                                var hash_token = reply;

                                                                logger.debug("The hash token is " + reply)

                                                                if (bill_token == Encrypt(hash_token, 'DuoS123412341234')) {

                                                                    if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                                        GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                                            if (token) {
                                                                                return res.send("dsdsds");
                                                                            } else {
                                                                                return res.status(401).send({message: 'Invalid email and/or password'});
                                                                            }
                                                                        });
                                                                    } else {

                                                                        return res.status(449).send({message: 'User console request is invalid'});
                                                                    }

                                                                } else {

                                                                    return res.status(449).send({message: 'Bill token is not match'});
                                                                }

                                                            } else {

                                                                logger.error("Hash token failed", err);
                                                                return res.status(449).send({message: 'Hash token is not found'});
                                                            }
                                                        });
                                                    } else {

                                                        logger.error("Bill token failed ", err);
                                                        return res.status(449).send({message: 'Bill token is not found'});
                                                    }
                                                });


                                            } else {

                                                if (console.consoleUserRoles && user.user_meta && user.user_meta.role && Array.isArray(console.consoleUserRoles) && console.consoleUserRoles.indexOf(user.user_meta.role) >= 0) {

                                                    GetJWT(user, claims_arr, req.body.clientID, 'password', req, function (err, isSuccess, token) {

                                                        if (token) {
                                                            return res.send("dsdsds");
                                                        } else {
                                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                                        }
                                                    });
                                                } else {

                                                    return res.status(449).send({message: 'User console request is invalid'});
                                                }

                                            }


                                        }
                                    }
                                });

                                //} else {

                                //return res.status(449).send({message: 'Activate your organization before login'});
                                //}
                                //}

                                //});
                            });
                        }
                    }

                });
            }else {
                return res.status(449).send({message: 'Activate your organization before login'});
            }
        });

    });
};

module.exports.Validation =  function(req, res) {
    //email.contact
    User.findOne({"username": req.body.userName}, '+password', function (err, user) {
        if (!user) {
            return res.status(401).send({message: 'Invalid email and/or password'});
        }

        if (config.auth.login_verification == true && !user.verified) {

            return res.status(449).send({message: 'Activate your account before login'});

        }else {

            user.comparePassword(req.body.password, function (err, isMatch) {
                if (!isMatch) {
                    return res.status(401).send({message: 'Invalid email and/or password'});
                }


                Org.findOne({tenant: user.tenant, id: user.company}, function (err, org) {
                    if (err) {

                        return res.status(449).send({message: 'Activate your organization before login'});

                    } else {

                        if (org && org.companyEnabled) {

                            return res.send({state: 'login', token: {}});

                        } else {

                            return res.status(449).send({message: 'Activate your organization before login'});

                        }
                    }

                });
            });
        }

    });
};

module.exports.SignUP = function(req, res) {

    logger.info("config.auth.signup_verification  -------->" +  config.auth.signup_verification);
    if(config.auth.signup_verification == true || config.auth.signup_verification == 'true') {

        if(!req.body || req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null) {
            return res.status(409).send({message: 'Please select captcha'});
        }


        var secretKey = config.auth.recaptcha_key;
            //"6LezaAsUAAAAAFbtiyMzOlMmqEwzMwmMYszmO_Ve";
        var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;

        request(verificationUrl, function (error, response, body) {
            body = JSON.parse(body);
            if (body.success !== undefined && !body.success) {

                return res.status(409).send({message: 'Failed captcha verification'});
            }
            User.findOne({"username": req.body.mail}, function (err, existingUser) {
                if (existingUser) {
                    return res.status(409).send({message: 'Email is already taken'});
                }
                var user = new User({
                    displayName: req.body.displayName,
                    email: {
                        contact: req.body.mail,
                        type: "email",
                        display: req.body.mail,
                        verified: false
                    },
                    username: req.body.mail,
                    password: req.body.password,
                    //user_meta: {role: "admin"},
                    systemuser: true,
                    //companyname: req.body.companyname,
                    // user_scopes: [
                    //     {scope: "organisation", read: true, write: true},
                    //     {scope: "resource", read: true},
                    //     {scope: "package", read: true},
                    //     {scope: "console", read: true},
                    //     {"scope": "myNavigation", "read": true},
                    //     {"scope": "myUserProfile", "read": true}
                    // ],
                    verified: false,
                    Active: true,
                    company: 0,
                    tenant: 1,
                    created_at: Date.now(),
                    updated_at: Date.now()

                });
                user.save(function (err, result) {
                    if (!err && result) {


                        orgService.CreateOrganisationStanAlone(user,req.body.companyname, req.body.timeZone, function (err, result) {

                            if (!err && result) {


                                crypto.randomBytes(20, function (err, buf) {
                                    var token = buf.toString('hex');

                                    var url = config.auth.ui_host + '#/activate/' + token;

                                    redisClient.set("activate" + ":" + token, result._id, function (err, val) {
                                        if (err) {

                                            res.status(404).send({message: 'Create activation token failed'});

                                        } else {


                                            redisClient.expireat("activate" + ":" + token, parseInt((+new Date) / 1000) + 86400);
                                            //var token = GetJWT(result, ["all_all"]);
                                            //res.send({state: "new", token: token});

                                            res.send({state: "new", message: "check mail"});

                                            var sendObj = {
                                                "company": config.Tenant.activeCompany,
                                                "tenant": config.Tenant.activeTenant
                                            };

                                            sendObj.to = req.body.mail;
                                            sendObj.from = "no-reply";
                                            sendObj.template = "By-User Registration Confirmation";
                                            sendObj.Parameters = {
                                                username: user.username,
                                                created_at: new Date(),
                                                url: url
                                            }

                                            PublishToQueue("EMAILOUT", sendObj)
                                        }
                                    });

                                });


                            } else {

                                res.status(404).send({message: 'Organization save failed'});
                            }
                        })


                    } else {
                        res.status(404).send({message: 'User save failed'});

                    }
                });
            });
        });
    }else{


        if(req.body.mail) {
            User.findOne({"username": req.body.mail}, function (err, existingUser) {
                if (existingUser) {
                    return res.status(409).send({message: 'Email is already taken'});
                }
                var user = new User({
                    displayName: req.body.displayName,
                    email: {
                        contact: req.body.mail,
                        type: "email",
                        display: req.body.mail,
                        verified: false
                    },
                    username: req.body.mail,
                    password: req.body.password,
                    //companyname: req.body.companyname,
                    //user_meta: {role: "admin"},
                    systemuser: true,
                    // user_scopes: [
                    //     {scope: "organisation", read: true, write: true},
                    //     {scope: "resource", read: true},
                    //     {scope: "package", read: true},
                    //     {scope: "console", read: true},
                    //     {"scope": "myNavigation", "read": true},
                    //     {"scope": "myUserProfile", "read": true}
                    // ],
                    Active: true,
                    company: 0,
                    tenant: 1,
                    created_at: Date.now(),
                    updated_at: Date.now()

                });
                user.save(function (err, result) {
                    if (!err && result) {


                        orgService.CreateOrganisationStanAlone(user,req.body.companyname, req.body.timeZone, function (err, result) {

                            if (!err && result) {


                                crypto.randomBytes(20, function (err, buf) {
                                    var token = buf.toString('hex');

                                    var url = config.auth.ui_host + '#/activate/' + token;

                                    redisClient.set("activate" + ":" + token, result._id, function (err, val) {
                                        if (err) {

                                            res.status(404).send({message: 'Create activation token failed'});

                                        } else {


                                            redisClient.expireat("activate" + ":" + token, parseInt((+new Date) / 1000) + 86400);
                                            //var token = GetJWT(result, ["all_all"]);
                                            //res.send({state: "new", token: token});
                                            res.send({state: "new", message: "check mail", companyId: result.company});

                                            var sendObj = {
                                                "company": config.Tenant.activeCompany,
                                                "tenant": config.Tenant.activeTenant
                                            };

                                            sendObj.to = req.body.mail;
                                            sendObj.from = "no-reply";
                                            sendObj.template = "By-User Registration Confirmation";
                                            sendObj.Parameters = {
                                                username: user.username,
                                                created_at: new Date(),
                                                url: url
                                            }

                                            PublishToQueue("EMAILOUT", sendObj)
                                        }
                                    });

                                });


                            } else {
                                if(err){
                                    logger.error('SignUp error !', err);
                                }

                                res.status(404).send({message: 'Organization save failed'});
                            }
                        })


                    } else {
                        res.status(404).send({message: 'User save failed'});

                    }
                });
            });
        }else{

            return res.status(409).send({message: 'No mail address found'});
        }
    }

};

module.exports.SignUPInvitation = function(req, res) {

    logger.info("config.auth.signup_verification  -------->" +  config.auth.signup_verification);
    if(config.auth.signup_verification == true || config.auth.signup_verification == 'true') {

        if(!req.body || req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null) {
            return res.status(409).send({message: 'Please select captcha'});
        }


        var secretKey = config.auth.recaptcha_key;
        //"6LezaAsUAAAAAFbtiyMzOlMmqEwzMwmMYszmO_Ve";
        var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;

        request(verificationUrl, function (error, response, body) {
            body = JSON.parse(body);
            if (body.success !== undefined && !body.success) {

                return res.status(409).send({message: 'Failed captcha verification'});
            }

            UserInvitation.findOne({
                _id: req.body.invitation
            }, function (err, invitation) {
                if (err || !invitation) {

                    return res.status(404).send({message: 'User Invitation Not Found'});
                } else {

                    var company = invitation.company;
                    var tenant = invitation.tenant;
                    var role =req.body.role;
                    var from = invitation.from;
                    var to = invitation.to;


                    Org.findOne({ tenant: tenant, id: company }, function (err, org) {
                        if (err) {

                            return res.status(404).send({message: 'Organization Not Found'});
                        } else {
                            if (org) {
                                /*
                                 to: val.username,
                                                from: from,
                                                status: 'pending',
                                                company: company,
                                                tenant: tenant,
                                                created_at: Date.now(),
                                                updated_at: Date.now(),
                                                message: message,

                                 */

                                if (role && to) {
                                    var userRole = role.toLowerCase();
                                    var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", userRole);
                                    if (limitObj) {
                                        if (limitObj.accessLimit > limitObj.currentAccess.length) {

                                            User.findOne({"username": to}, function (err, existingUser) {

                                                if (err) {

                                                    return res.status(409).send({message: 'User validation failed'});

                                                } else {


                                                    if (existingUser) {
                                                        return res.status(409).send({message: 'Email is already taken'});
                                                    }
                                                    var user = new User({
                                                        displayName: req.body.displayName,
                                                        email: {
                                                            contact: to,
                                                            type: "email",
                                                            display: to,
                                                            verified: false
                                                        },
                                                        username: to,
                                                        password: req.body.password,
                                                        //user_meta: {role: "admin"},
                                                        systemuser: true,
                                                        //companyname: req.body.companyname,
                                                        // user_scopes: [
                                                        //     {scope: "organisation", read: true, write: true},
                                                        //     {scope: "resource", read: true},
                                                        //     {scope: "package", read: true},
                                                        //     {scope: "console", read: true},
                                                        //     {"scope": "myNavigation", "read": true},
                                                        //     {"scope": "myUserProfile", "read": true}
                                                        // ],
                                                        verified: false,
                                                        Active: true,
                                                        company: 0,
                                                        tenant: 1,
                                                        created_at: Date.now(),
                                                        updated_at: Date.now()

                                                    });


                                                    if (req.body.veeryaccount) {
                                                        user.veeryaccount = req.body.veeryaccount;
                                                    }

                                                    if (config.auth.login_verification) {

                                                        user.verified = false;

                                                    } else {

                                                        user.verified = true;
                                                    }


                                                    user.save(function (err, result) {
                                                        if (!err && result) {


                                                            var userAccount = UserAccount({
                                                                active: true,
                                                                verified: true,
                                                                joined: Date.now(),
                                                                user: user.username,
                                                                userref: user._id,
                                                                tenant: org.tenant,
                                                                company: org.id,
                                                                user_meta: { role: userRole },
                                                                app_meta: {},
                                                                created_at: Date.now(),
                                                                updated_at: Date.now(),
                                                                multi_login: false
                                                            });

                                                            userAccount.save(function (err, account) {
                                                                if (err) {
                                                                    user.remove(function (err) {
                                                                    });
                                                                    return res.status(400).send({message: 'Accountr Creation failed'});
                                                                } else {

                                                                    limitObj.currentAccess.push(user.username);
                                                                    Org.findOneAndUpdate({
                                                                        id: company,
                                                                        tenant: tenant
                                                                    }, org, function (err, rOrg) {
                                                                        if (err) {
                                                                            user.remove(function (err) {
                                                                            });
                                                                            return res.status(400).send({message: 'Limit Update failed'});
                                                                        } else {

                                                                            UserInvitation.findOneAndUpdate({
                                                                                _id: req.body.invitation,
                                                                                company: company,
                                                                                tenant: tenant,
                                                                                to: to,
                                                                                status: "pending"
                                                                            }, {status: "accepted", update_at: Date.now()}, function (err, invitation) {

                                                                                if (config.auth.login_verification) {

                                                                                    crypto.randomBytes(20, function (err, buf) {
                                                                                        var token = buf.toString('hex');

                                                                                        var url = config.auth.ui_host + '#/activate/' + token;

                                                                                        if (userRole == "agent") {

                                                                                            url = config.auth.agent_host + '#/activate/' + token;
                                                                                        }

                                                                                        redisClient.set("activate" + ":" + token, user._id, function (err, val) {
                                                                                            if (err) {

                                                                                                jsonString = messageFormatter.FormatMessage(err, "Create activation token failed", false, user);
                                                                                                res.end(jsonString);

                                                                                            } else {


                                                                                                redisClient.expireat("activate" + ":" + token, parseInt((+new Date) / 1000) + 86400);

                                                                                                var sendObj = {
                                                                                                    "company": config.Tenant.activeCompany,
                                                                                                    "tenant": config.Tenant.activeTenant
                                                                                                };

                                                                                                sendObj.to = req.body.mail;
                                                                                                sendObj.from = "no-reply";
                                                                                                sendObj.template = "By-User Registration Confirmation";
                                                                                                sendObj.Parameters = {
                                                                                                    username: user.username,
                                                                                                    created_at: new Date(),
                                                                                                    url: url
                                                                                                }

                                                                                                PublishToQueue("EMAILOUT", sendObj)

                                                                                                jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                                                                res.end(jsonString);
                                                                                            }
                                                                                        });

                                                                                    });
                                                                                } else {

                                                                                    jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                                                    res.end(jsonString);
                                                                                }
                                                                            });

                                                                        }

                                                                    });

                                                                }
                                                            });

                                                        } else {
                                                            res.status(404).send({message: 'User save failed'});

                                                        }
                                                    });
                                                }
                                            });
                                        }
                                        else{
                                            return res.status(401).send({message: 'Limit has exceeded'});
                                        }
                                    }else{
                                        return res.status(401).send({message: 'Limit Not Found'});
                                    }
                                }
                                else{
                                    return res.status(404).send({message: 'Role Not Found'});
                                }
                            }
                            else{
                                return res.status(404).send({message: 'Organization Not Found'});
                            }
                        }
                    });
                }
            });
        });
    }else {


        UserInvitation.findOne({
            _id: req.body.invitation
        }, function (err, invitation) {
            if (err || !invitation) {

                return res.status(404).send({message: 'User Invitation Not Found'});
            } else {

                var company = invitation.company;
                var tenant = invitation.tenant;
                var role = req.body.role;
                var from = invitation.from;
                var to = invitation.to;


                Org.findOne({tenant: tenant, id: company}, function (err, org) {
                    if (err) {

                        return res.status(404).send({message: 'Organization Not Found'});
                    } else {
                        if (org) {
                            /*
                             to: val.username,
                                            from: from,
                                            status: 'pending',
                                            company: company,
                                            tenant: tenant,
                                            created_at: Date.now(),
                                            updated_at: Date.now(),
                                            message: message,

                             */

                            if (role && to) {
                                var userRole = role.toLowerCase();
                                var limitObj = FilterObjFromArray(org.consoleAccessLimits, "accessType", userRole);
                                if (limitObj) {
                                    if (limitObj.accessLimit > limitObj.currentAccess.length) {

                                        User.findOne({"username": to}, function (err, existingUser) {

                                            if (err) {

                                                return res.status(409).send({message: 'User validation failed'});

                                            } else {


                                                if (existingUser) {
                                                    return res.status(409).send({message: 'Email is already taken'});
                                                }
                                                var user = new User({
                                                    displayName: req.body.displayName,
                                                    email: {
                                                        contact: to,
                                                        type: "email",
                                                        display: to,
                                                        verified: false
                                                    },
                                                    username: to,
                                                    password: req.body.password,
                                                    //user_meta: {role: "admin"},
                                                    systemuser: true,
                                                    //companyname: req.body.companyname,
                                                    // user_scopes: [
                                                    //     {scope: "organisation", read: true, write: true},
                                                    //     {scope: "resource", read: true},
                                                    //     {scope: "package", read: true},
                                                    //     {scope: "console", read: true},
                                                    //     {"scope": "myNavigation", "read": true},
                                                    //     {"scope": "myUserProfile", "read": true}
                                                    // ],
                                                    verified: false,
                                                    Active: true,
                                                    company: 0,
                                                    tenant: 1,
                                                    created_at: Date.now(),
                                                    updated_at: Date.now()

                                                });


                                                if (req.body.veeryaccount) {
                                                    user.veeryaccount = req.body.veeryaccount;
                                                }

                                                if (config.auth.login_verification) {

                                                    user.verified = false;

                                                } else {

                                                    user.verified = true;
                                                }


                                                user.save(function (err, result) {
                                                    if (!err && result) {


                                                        var userAccount = UserAccount({
                                                            active: true,
                                                            verified: true,
                                                            joined: Date.now(),
                                                            user: user.username,
                                                            userref: user._id,
                                                            tenant: org.tenant,
                                                            company: org.id,
                                                            user_meta: {role: userRole},
                                                            app_meta: {},
                                                            created_at: Date.now(),
                                                            updated_at: Date.now(),
                                                            multi_login: false
                                                        });

                                                        userAccount.save(function (err, account) {
                                                            if (err) {
                                                                user.remove(function (err) {
                                                                });
                                                                return res.status(400).send({message: 'Accountr Creation failed'});
                                                            } else {

                                                                limitObj.currentAccess.push(user.username);
                                                                Org.findOneAndUpdate({
                                                                    id: company,
                                                                    tenant: tenant
                                                                }, org, function (err, rOrg) {
                                                                    if (err) {
                                                                        user.remove(function (err) {
                                                                        });
                                                                        return res.status(400).send({message: 'Limit Update failed'});
                                                                    } else {

                                                                        UserInvitation.findOneAndUpdate({
                                                                            _id: req.body.invitation,
                                                                            company: company,
                                                                            tenant: tenant,
                                                                            to: to,
                                                                            status: "pending"
                                                                        }, {
                                                                            status: "accepted",
                                                                            update_at: Date.now()
                                                                        }, function (err, invitation) {

                                                                            if (config.auth.login_verification) {

                                                                                crypto.randomBytes(20, function (err, buf) {
                                                                                    var token = buf.toString('hex');

                                                                                    var url = config.auth.ui_host + '#/activate/' + token;

                                                                                    if (userRole == "agent") {

                                                                                        url = config.auth.agent_host + '#/activate/' + token;
                                                                                    }

                                                                                    redisClient.set("activate" + ":" + token, user._id, function (err, val) {
                                                                                        if (err) {

                                                                                            jsonString = messageFormatter.FormatMessage(err, "Create activation token failed", false, user);
                                                                                            res.end(jsonString);

                                                                                        } else {


                                                                                            redisClient.expireat("activate" + ":" + token, parseInt((+new Date) / 1000) + 86400);

                                                                                            var sendObj = {
                                                                                                "company": config.Tenant.activeCompany,
                                                                                                "tenant": config.Tenant.activeTenant
                                                                                            };

                                                                                            sendObj.to = req.body.mail;
                                                                                            sendObj.from = "no-reply";
                                                                                            sendObj.template = "By-User Registration Confirmation";
                                                                                            sendObj.Parameters = {
                                                                                                username: user.username,
                                                                                                created_at: new Date(),
                                                                                                url: url
                                                                                            }

                                                                                            PublishToQueue("EMAILOUT", sendObj)

                                                                                            jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                                                            res.end(jsonString);
                                                                                        }
                                                                                    });

                                                                                });
                                                                            } else {

                                                                                jsonString = messageFormatter.FormatMessage(err, "Create Account successful", true, user);
                                                                                res.end(jsonString);
                                                                            }
                                                                        });

                                                                    }

                                                                });

                                                            }
                                                        });

                                                    } else {
                                                        res.status(404).send({message: 'User save failed'});

                                                    }
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        return res.status(401).send({message: 'Limit has exceeded'});
                                    }
                                } else {
                                    return res.status(401).send({message: 'Limit Not Found'});
                                }
                            }
                            else {
                                return res.status(404).send({message: 'Role Not Found'});
                            }
                        }
                        else {
                            return res.status(404).send({message: 'Organization Not Found'});
                        }
                    }
                });
            }
        });


    }

};


//SignUPInvitation

module.exports.Google_back = function(req, res) {
    var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token';
    var peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect';
    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: config.auth.GOOGLE_SECRET,
        redirect_uri: req.body.redirectUri,
        grant_type: 'authorization_code'
    };

    var claims_arr = ["all_all"];
    if (req.body.scope && util.isArray(req.body.scope) && req.body.scope.length > 0) {

        claims_arr = req.body.scope;
    }

    // Step 1. Exchange authorization code for access token.
    request.post(accessTokenUrl, {json: true, form: params}, function (err, response, token) {

        if (token) {
            var accessToken = token.access_token;
            var headers = {Authorization: 'Bearer ' + accessToken};

            // Step 2. Retrieve profile information about the current user.
            request.get({url: peopleApiUrl, headers: headers, json: true}, function (err, response, profile) {
                if (profile.error) {
                    return res.status(500).send({message: profile.error.message});
                }
                // Step 3a. Link user accounts.
                if (req.header('Authorization')) {
                    User.findOne({"googleplus.cid": profile.sub}, function (err, existingUser) {
                        if (existingUser) {
                            return res.status(409).send({message: 'There is already a Google account that belongs to you'});
                        }
                        var token = req.header('Authorization').split(' ')[1];


                        GetVerification(token, function (err, payload) {

                            if (!err && payload) {
                                User.findOne({username: payload.iss}, function (err, user) {
                                    if (!user) {
                                        return res.status(400).send({message: 'User not found'});
                                    }

                                    user.googleplus = {
                                        contact: profile.email,
                                        cid: profile.sub,
                                        type: "google",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };

                                    user.email = {
                                        contact: profile.email,
                                        type: "email",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };

                                    user.avatar = user.avatar || profile.picture.replace('sz=50', 'sz=200');
                                    user.displayname = user.displayname || profile.name;
                                    user.firstname = user.firstname || profile.given_name;
                                    user.lastname = user.lastname || profile.family_name;
                                    user.locale = user.locale || profile.locale,
                                        user.save(function () {
                                            //var token = GetJWT(user,claims_arr);


                                            GetJWT(user, claims_arr, req.body.clientId, 'oauth-google+', req,function (err, isSuccess, token) {

                                                if (token) {
                                                    return res.send({state: "linking", token: token});
                                                } else {
                                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                                }
                                            })


                                        });
                                });
                            } else {

                                return res.status(401).send({message: 'Token is not verified'});
                            }

                        });
                    });
                } else {
                    // Step 3b. Create a new user account or return an existing one.


                    User.findOne({"username": profile.email}, function (err, user) {
                        if (!user) {
                            User.findOne({"googleplus.cid": profile.sub}, function (err, existingUser) {
                                if (existingUser) {
                                    //return res.send({state: 'existing',token: GetJWT(existingUser, claims_arr)});

                                    GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-google+', req,function (err, isSuccess, token) {

                                        if (token) {
                                            return res.send({state: "existing", token: token});
                                        } else {
                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                        }
                                    });
                                } else {
                                    var user = new User();
                                    user.googleplus = {
                                        contact: profile.email,
                                        cid: profile.sub,
                                        type: "google",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };

                                    user.email = {
                                        contact: profile.email,
                                        type: "email",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };

                                    user.avatar = profile.picture.replace('sz=50', 'sz=200');
                                    user.displayName = profile.name;
                                    user.firstname = profile.given_name;
                                    user.lastname = profile.family_name;
                                    user.locale = profile.locale;
                                    user.company = 0;
                                    user.tenant = 1;
                                    user.systemuser = true,
                                        user.username = profile.email;
                                    user.user_meta = {role: "admin"};
                                    user.user_scopes = [
                                        {scope: "organisation", read: true, write: true},
                                        {scope: "resource", read: true},
                                        {scope: "package", read: true},
                                        {scope: "console", read: true},
                                        {"scope": "myNavigation", "read": true},
                                        {"scope": "myUserProfile", "read": true}
                                    ];

                                    var defaultTimezone = {tz: "", utcOffset: ""};

                                    user.save(function (err) {

                                        if (!err) {
                                            orgService.CreateOrganisationStanAlone(user,profile.email, defaultTimezone, function (err, rUser) {
                                                if (!err && rUser) {

                                                    //var token = GetJWT(rUser,claims_arr);
                                                    //res.send({state: "new", token: token});
                                                    //
                                                    //var sendObj = {
                                                    //    "company": 0,
                                                    //    "tenant": 1
                                                    //};
                                                    //
                                                    //sendObj.to =  profile.email;
                                                    //sendObj.from = "no-reply", sendObj.template = "By-User Registration Success";
                                                    //sendObj.Parameters = user
                                                    //
                                                    //PublishToQueue("EMAILOUT", sendObj)

                                                    GetJWT(rUser, claims_arr, req.body.clientId, 'oauth-google+', req,function (err, isSuccess, token) {

                                                        if (token) {

                                                            var sendObj = {
                                                                "company": config.Tenant.activeCompany,
                                                                "tenant": config.Tenant.activeTenant
                                                            };

                                                            sendObj.to = profile.email;
                                                            sendObj.from = "no-reply",
                                                                sendObj.template = "By-User Registration Success";
                                                            sendObj.Parameters = user;

                                                            PublishToQueue("EMAILOUT", sendObj);

                                                            return res.send({state: "new", token: token});
                                                        } else {
                                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                                        }
                                                    });


                                                } else {

                                                    res.status(404).send({message: 'Organization save failed'});
                                                }
                                            })

                                        } else {
                                            res.status(404).send({message: 'User save failed'});
                                        }
                                    });
                                }
                            });
                        } else {

                            User.findOne({"googleplus.cid": profile.sub}, function (err, existingUser) {
                                if (existingUser) {
                                    //return res.send({state: 'existing', token: GetJWT(existingUser, claims_arr)});

                                    GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-google+',req, function (err, isSuccess, token) {

                                        if (token) {
                                            return res.send({state: "existing", token: token});
                                        } else {
                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                        }
                                    })
                                } else {

                                    user.googleplus = {
                                        contact: profile.email,
                                        cid: profile.sub,
                                        type: "google",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };


                                    user.avatar = user.avatar || profile.picture.replace('sz=50', 'sz=200');
                                    user.displayname = user.displayname || profile.name;
                                    user.firstname = user.firstname || profile.given_name;
                                    user.lastname = user.lastname || profile.family_name;
                                    user.locale = user.locale || profile.locale,
                                        user.save(function () {


                                            GetJWT(user, claims_arr, req.body.clientId, 'oauth-google+',req, function (err, isSuccess, token) {

                                                if (token) {
                                                    return res.send({state: "linking", token: token});
                                                } else {
                                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                                }
                                            });


                                        });
                                }
                            });

                        }
                    });


                }
            });
        } else {
            return res.status(401).send({message: 'Token is not verified'});
        }
    });
};

module.exports.Google = function(req, res) {
    var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token';
    var peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect';
    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: config.auth.GOOGLE_SECRET,
        redirect_uri: req.body.redirectUri,
        grant_type: 'authorization_code'
    };

    var claims_arr = ["all_all"];
    if (req.body.scope && util.isArray(req.body.scope) && req.body.scope.length > 0) {

        claims_arr = req.body.scope;
    }

    var companyName = req.body.companyname;

    // Step 1. Exchange authorization code for access token.
    request.post(accessTokenUrl, {json: true, form: params}, function (err, response, token) {

        if (token && companyName) {
            var accessToken = token.access_token;
            var headers = {Authorization: 'Bearer ' + accessToken};

            // Step 2. Retrieve profile information about the current user.
            request.get({url: peopleApiUrl, headers: headers, json: true}, function (err, response, profile) {
                if (profile && profile.error) {
                    return res.status(500).send({message: profile.error.message});
                }
                // Step 3a. Link user accounts.
                // if (req.header('Authorization')) {
                //     User.findOne({"googleplus.cid": profile.sub}, function (err, existingUser) {
                //         if (existingUser) {
                //             return res.status(409).send({message: 'There is already a Google account that belongs to you'});
                //         }
                //         var token = req.header('Authorization').split(' ')[1];
                //
                //
                //         GetVerification(token, function (err, payload) {
                //
                //             if (!err && payload) {
                //                 User.findOne({username: payload.iss}, function (err, user) {
                //                     if (!user) {
                //                         return res.status(400).send({message: 'User not found'});
                //                     }
                //
                //                     user.googleplus = {
                //                         contact: profile.email,
                //                         cid: profile.sub,
                //                         type: "google",
                //                         display: profile.name,
                //                         verified: profile.email_verified
                //                     };
                //
                //                     user.email = {
                //                         contact: profile.email,
                //                         type: "email",
                //                         display: profile.name,
                //                         verified: profile.email_verified
                //                     };
                //
                //                     user.avatar = user.avatar || profile.picture.replace('sz=50', 'sz=200');
                //                     user.displayname = user.displayname || profile.name;
                //                     user.firstname = user.firstname || profile.given_name;
                //                     user.lastname = user.lastname || profile.family_name;
                //                     user.locale = user.locale || profile.locale,
                //                         user.save(function () {
                //                             //var token = GetJWT(user,claims_arr);
                //
                //                             Org.findOne({"companyName": companyName}, function (err, org) {
                //                                 if (err) {
                //                                     return res.status(401).send({message: 'Company verification failed'});
                //                                 }
                //
                //                                 if (!org) {
                //                                     return res.status(401).send({message: 'Invalid organization name'});
                //                                 }
                //
                //                                 if (org && org.companyEnabled) {
                //                                     UserAccount.findOne({
                //                                         "tenant": org.tenant,
                //                                         "company": org.id,
                //                                         "user": existingUser.username
                //                                     }, function (err, account) {
                //                                         if (err) {
                //                                             return res.status(401).send({message: 'User account verification failed'});
                //                                         }
                //                                         if (!account) {
                //                                             return res.status(401).send({message: 'Invalid user account'});
                //                                         }
                //
                //                                         if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                //                                             && account.verified != true) {
                //                                             return res.status(401).send({message: 'User account is not verified'});
                //                                         }
                //
                //                                         if (account.active != true) {
                //                                             return res.status(401).send({message: 'User account is not active'});
                //                                         }
                //
                //
                //                                         //user = user.toObject();
                //                                         existingUser._doc.tenant = org.tenant;
                //                                         existingUser._doc.company = org.id;
                //                                         existingUser._doc.companyName = org.companyName;
                //                                         existingUser._doc.multi_login = account.multi_login;
                //                                         existingUser._doc.user_meta = account.user_meta;
                //                                         existingUser._doc.app_meta = account.app_meta;
                //                                         existingUser._doc.user_scopes = account.user_scopes;
                //                                         existingUser._doc.client_scopes = account.client_scopes;
                //                                         existingUser._doc.resourceid = account.resource_id;
                //                                         existingUser._doc.veeryaccount = account.veeryaccount;
                //                                         existingUser._doc.multi_login = account.multi_login;
                //
                //
                //                                         GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-google+', req, function (err, isSuccess, token) {
                //
                //                                             if (token) {
                //                                                 return res.send({state: "linking", token: token});
                //                                             } else {
                //                                                 return res.status(401).send({message: 'Invalid email and/or password'});
                //                                             }
                //                                         })
                //                                     });
                //                                 }
                //                             });
                //
                //                         });
                //                 });
                //             } else {
                //
                //                 return res.status(401).send({message: 'Token is not verified'});
                //             }
                //
                //         });
                //     });
                // } else {
                //     // Step 3b. Create a new user account or return an existing one.


                    User.findOne({"username": profile.email}, function (err, user) {
                        if (!user) {
                            ////////////////////////no user found should save user/account/organization ////////////////////////////////////////
                            User.findOne({"googleplus.cid": profile.sub}, function (err, existingUser) {
                                if (existingUser) {
                                    //return res.send({state: 'existing',token: GetJWT(existingUser, claims_arr)});
                                    Org.findOne({"companyName": companyName}, function (err, org) {
                                        if (err) {
                                            return res.status(401).send({message: 'Company verification failed'});
                                        }

                                        if (!org) {
                                            return res.status(401).send({message: 'Invalid organization name'});
                                        }

                                        if (org && org.companyEnabled) {
                                            UserAccount.findOne({
                                                "tenant": org.tenant,
                                                "company": org.id,
                                                "user": existingUser.username
                                            }, function (err, account) {
                                                if (err) {
                                                    return res.status(401).send({message: 'User account verification failed'});
                                                }
                                                if (!account) {
                                                    return res.status(401).send({message: 'Invalid user account'});
                                                }

                                                if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                    && account.verified != true) {
                                                    return res.status(401).send({message: 'User account is not verified'});
                                                }

                                                if (account.active != true) {
                                                    return res.status(401).send({message: 'User account is not active'});
                                                }


                                                //user = user.toObject();
                                                existingUser._doc.tenant = org.tenant;
                                                existingUser._doc.company = org.id;
                                                existingUser._doc.companyName = org.companyName;
                                                existingUser._doc.multi_login = account.multi_login;
                                                existingUser._doc.user_meta = account.user_meta;
                                                existingUser._doc.app_meta = account.app_meta;
                                                existingUser._doc.user_scopes = account.user_scopes;
                                                existingUser._doc.client_scopes = account.client_scopes;
                                                existingUser._doc.resourceid = account.resource_id;
                                                existingUser._doc.veeryaccount = account.veeryaccount;
                                                existingUser._doc.multi_login = account.multi_login;

                                                GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-google+', req, function (err, isSuccess, token) {

                                                    if (token) {
                                                        return res.send({state: "existing", token: token});
                                                    } else {
                                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                                    }
                                                });
                                            });
                                        }
                                    })
                                } else {
                                    var user = new User();
                                    user.googleplus = {
                                        contact: profile.email,
                                        cid: profile.sub,
                                        type: "google",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };

                                    user.email = {
                                        contact: profile.email,
                                        type: "email",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };

                                    user.avatar = profile.picture.replace('sz=50', 'sz=200');
                                    user.displayName = profile.name;
                                    user.firstname = profile.given_name;
                                    user.lastname = profile.family_name;
                                    user.locale = profile.locale;
                                    user.company = 0;
                                    user.tenant = 1;
                                    user.systemuser = true,
                                        user.username = profile.email;
                                    user.user_meta = {role: "admin"};
                                    user.user_scopes = [
                                        {scope: "organisation", read: true, write: true},
                                        {scope: "resource", read: true},
                                        {scope: "package", read: true},
                                        {scope: "console", read: true},
                                        {"scope": "myNavigation", "read": true},
                                        {"scope": "myUserProfile", "read": true}
                                    ];


                                    var defaultTimezone = {tz: "", utcOffset: ""};

                                    user.save(function (err) {

                                        if (!err) {
                                            //profile.email
                                            orgService.CreateOrganisationStanAlone(user, companyName, defaultTimezone, function (err, rUser) {
                                                if (!err && rUser) {

                                                    //var token = GetJWT(rUser,claims_arr);
                                                    //res.send({state: "new", token: token});
                                                    //
                                                    //var sendObj = {
                                                    //    "company": 0,
                                                    //    "tenant": 1
                                                    //};
                                                    //
                                                    //sendObj.to =  profile.email;
                                                    //sendObj.from = "no-reply", sendObj.template = "By-User Registration Success";
                                                    //sendObj.Parameters = user
                                                    //
                                                    //PublishToQueue("EMAILOUT", sendObj)
                                                    GetJWT(rUser, claims_arr, req.body.clientId, 'oauth-google+', req, function (err, isSuccess, token) {

                                                        if (token) {

                                                            var sendObj = {
                                                                "company": config.Tenant.activeCompany,
                                                                "tenant": config.Tenant.activeTenant
                                                            };

                                                            sendObj.to = profile.email;
                                                            sendObj.from = "no-reply",
                                                                sendObj.template = "By-User Registration Success";
                                                            sendObj.Parameters = user;

                                                            PublishToQueue("EMAILOUT", sendObj);

                                                            return res.send({state: "new", token: token});
                                                        } else {
                                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                                        }
                                                    });


                                                } else {

                                                    res.status(404).send({message: 'Organization save failed'});
                                                }
                                            })

                                        } else {
                                            res.status(404).send({message: 'User save failed'});
                                        }
                                    });
                                }
                            });
                        } else {

                            User.findOne({"googleplus.cid": profile.sub}, function (err, existingUser) {
                                if (existingUser) {
                                    //return res.send({state: 'existing', token: GetJWT(existingUser, claims_arr)});

                                    Org.findOne({"companyName": companyName}, function (err, org) {
                                        if (err) {
                                            return res.status(401).send({message: 'Company verification failed'});
                                        }

                                        if (!org) {
                                            return res.status(401).send({message: 'Invalid organization name'});
                                        }

                                        if (org && org.companyEnabled) {
                                            UserAccount.findOne({
                                                "tenant": org.tenant,
                                                "company": org.id,
                                                "user": existingUser.username
                                            }, function (err, account) {
                                                if (err) {
                                                    return res.status(401).send({message: 'User account verification failed'});
                                                }
                                                if (!account) {
                                                    return res.status(401).send({message: 'Invalid user account'});
                                                }

                                                if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                    && account.verified != true) {
                                                    return res.status(401).send({message: 'User account is not verified'});
                                                }

                                                if (account.active != true) {
                                                    return res.status(401).send({message: 'User account is not active'});
                                                }


                                                //user = user.toObject();
                                                existingUser._doc.tenant = org.tenant;
                                                existingUser._doc.company = org.id;
                                                existingUser.companyName = org.companyName;
                                                existingUser._doc.multi_login = account.multi_login;
                                                existingUser._doc.user_meta = account.user_meta;
                                                existingUser._doc.app_meta = account.app_meta;
                                                existingUser._doc.user_scopes = account.user_scopes;
                                                existingUser._doc.client_scopes = account.client_scopes;
                                                existingUser._doc.resourceid = account.resource_id;
                                                existingUser._doc.veeryaccount = account.veeryaccount;
                                                existingUser._doc.multi_login = account.multi_login;


                                                GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-google+', req, function (err, isSuccess, token) {

                                                    if (token) {
                                                        return res.send({state: "existing", token: token});
                                                    } else {
                                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                                    }
                                                })
                                            });
                                        }
                                    });
                                } else {

                                    user.googleplus = {
                                        contact: profile.email,
                                        cid: profile.sub,
                                        type: "google",
                                        display: profile.name,
                                        verified: profile.email_verified
                                    };


                                    user.avatar = user.avatar || profile.picture.replace('sz=50', 'sz=200');
                                    user.displayname = user.displayname || profile.name;
                                    user.firstname = user.firstname || profile.given_name;
                                    user.lastname = user.lastname || profile.family_name;
                                    user.locale = user.locale || profile.locale,
                                        user.save(function () {

                                            Org.findOne({"companyName": companyName}, function (err, org) {
                                                if (err) {
                                                    return res.status(401).send({message: 'Company verification failed'});
                                                }

                                                if (!org) {
                                                    return res.status(401).send({message: 'Invalid organization name'});
                                                }

                                                if (org && org.companyEnabled) {
                                                    UserAccount.findOne({
                                                        "tenant": org.tenant,
                                                        "company": org.id,
                                                        "user": user.username
                                                    }, function (err, account) {
                                                        if (err) {
                                                            return res.status(401).send({message: 'User account verification failed'});
                                                        }
                                                        if (!account) {
                                                            return res.status(401).send({message: 'Invalid user account'});
                                                        }

                                                        if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                            && account.verified != true) {
                                                            return res.status(401).send({message: 'User account is not verified'});
                                                        }

                                                        if (account.active != true) {
                                                            return res.status(401).send({message: 'User account is not active'});
                                                        }


                                                        //user = user.toObject();
                                                        user._doc.tenant = org.tenant;
                                                        user._doc.company = org.id;
                                                        user.companyName = org.companyName;
                                                        user._doc.multi_login = account.multi_login;
                                                        user._doc.user_meta = account.user_meta;
                                                        user._doc.app_meta = account.app_meta;
                                                        user._doc.user_scopes = account.user_scopes;
                                                        user._doc.client_scopes = account.client_scopes;
                                                        user._doc.resourceid = account.resource_id;
                                                        user._doc.veeryaccount = account.veeryaccount;
                                                        user._doc.multi_login = account.multi_login;

                                                        GetJWT(user, claims_arr, req.body.clientId, 'oauth-google+', req, function (err, isSuccess, token) {

                                                            if (token) {
                                                                return res.send({state: "linking", token: token});
                                                            } else {
                                                                return res.status(401).send({message: 'Invalid email and/or password'});
                                                            }
                                                        });
                                                    });
                                                }
                                            });

                                        });
                                }
                            });

                        }
                    });
                //}
            });
        } else {
            return res.status(401).send({message: 'Token or CompanyName is not verified'});
        }
    });
};

module.exports.GitHub = function(req, res) {
    var accessTokenUrl = 'https://github.com/login/oauth/access_token';
    var userApiUrl = 'https://api.github.com/user';
    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: config.auth.GITHUB_SECRET,
        redirect_uri: req.body.redirectUri
    };

    var claims_arr = ["all_all"];
    if(req.body.scope && util.isArray(req.body.scope) && req.body.scope.length >0){

        claims_arr = req.body.scope;
    }

    var companyName = req.body.companyname;
    // Step 1. Exchange authorization code for access token.
    request.get({ url: accessTokenUrl, qs: params }, function(err, response, accessToken) {
        accessToken = qs.parse(accessToken);
        var headers = { 'User-Agent': 'Satellizer' };

        // Step 2. Retrieve profile information about the current user.
        request.get({ url: userApiUrl, qs: accessToken, headers: headers, json: true }, function(err, response, profile) {

            // Step 3a. Link user accounts.
            if (req.header('Authorization')) {


                User.findOne({"github.cid": profile.sub}, function (err, existingUser) {
                    if (existingUser) {
                        return res.status(409).send({message: 'There is already a Google account that belongs to you'});
                    }
                    var token = req.header('Authorization').split(' ')[1];


                    GetVerification(token, function (err, payload) {

                        if (!err && payload) {
                            User.findOne({username: payload.iss}, function (err, user) {
                                if (!user) {
                                    return res.status(400).send({message: 'User not found'});
                                }

                                user.github = {
                                    contact: profile.email,
                                    cid: profile.id,
                                    type: "github",
                                    display: profile.name,
                                    verified: true
                                };

                                user.email = {
                                    contact: profile.email,
                                    type: "email",
                                    display: profile.name,
                                    verified: true
                                };

                                user.avatar = user.avatar || profile.avatar_url;
                                user.displayname = user.displayname || profile.name;

                                user.save(function () {

                                    Org.findOne({"companyName": companyName}, function (err, org) {
                                        if (err) {
                                            return res.status(401).send({message: 'Company verification failed'});
                                        }

                                        if (!org) {
                                            return res.status(401).send({message: 'Invalid organization name'});
                                        }

                                        if (org && org.companyEnabled) {
                                            UserAccount.findOne({
                                                "tenant": org.tenant,
                                                "company": org.id,
                                                "user": existingUser.username
                                            }, function (err, account) {
                                                if (err) {
                                                    return res.status(401).send({message: 'User account verification failed'});
                                                }
                                                if (!account) {
                                                    return res.status(401).send({message: 'Invalid user account'});
                                                }

                                                if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                    && account.verified != true) {
                                                    return res.status(401).send({message: 'User account is not verified'});
                                                }

                                                if (account.active != true) {
                                                    return res.status(401).send({message: 'User account is not active'});
                                                }


                                                //user = user.toObject();
                                                user._doc.tenant = org.tenant;
                                                user._doc.company = org.id;
                                                user.companyName = org.companyName;
                                                user._doc.multi_login = account.multi_login;
                                                user._doc.user_meta = account.user_meta;
                                                user._doc.app_meta = account.app_meta;
                                                user._doc.user_scopes = account.user_scopes;
                                                user._doc.client_scopes = account.client_scopes;
                                                user._doc.resourceid = account.resource_id;
                                                user._doc.veeryaccount = account.veeryaccount;
                                                user._doc.multi_login = account.multi_login;


                                                GetJWT(user, claims_arr, req.body.clientId, 'oauth-github', req, function (err, isSuccess, token) {

                                                    if (token) {
                                                        return res.send({state: "linking", token: token});
                                                    } else {
                                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                                    }
                                                });

                                                //var token = GetJWT(user,claims_arr);
                                                ///res.send({state: "linking",token: token});
                                            });
                                        }
                                    });
                                });
                            });
                        } else {

                            return res.status(401).send({message: 'Token is not verified'});
                        }

                    });
                });


            } else {
                // Step 3b. Create a new user account or return an existing one.

                User.findOne({"username": profile.email},  function (err, user) {
                    if (!user) {
                        User.findOne({"github.cid": profile.id}, function (err, existingUser) {
                            if (existingUser) {
                                //return res.send({state: 'existing',token: GetJWT(existingUser, claims_arr)});

                                GetJWT(existingUser,claims_arr,req.body.clientId,'oauth-github', req,function(err, isSuccess, token){

                                    if(token){
                                        return res.send({state: "existing", token: token});
                                    }else{
                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                    }
                                });
                            }else {
                                var user = new User();
                                user.github = {
                                    contact: profile.email,
                                    cid: profile.id,
                                    type: "github",
                                    display: profile.name,
                                    verified: true
                                };

                                user.email = {
                                    contact: profile.email,
                                    type: "email",
                                    display: profile.name,
                                    verified: true
                                };
                                user.avatar = profile.avatar_url;
                                user.displayName = profile.name;
                                user.firstname = profile.login;
                                //user.lastname = profile.family_name;
                                //user.locale = profile.locale;
                                user.company = 0;
                                user.tenant = 1;
                                user.systemuser = true,
                                    user.username = profile.email;
                                user.user_meta = {role: "admin"};
                                user.user_scopes = [
                                    {scope: "organisation", read: true, write: true},
                                    {scope: "resource", read: true},
                                    {scope: "package", read: true},
                                    {scope: "console", read: true},
                                    {"scope": "myNavigation", "read": true},
                                    {"scope": "myUserProfile", "read": true}
                                ];


                                user.save(function (err) {

                                    if (!err) {

                                        var defaultTimezone = {tz: "", utcOffset: ""};
                                        orgService.CreateOrganisationStanAlone(user,companyName, defaultTimezone, function (err, rUser) {

                                            if (!err && rUser) {

                                                //var token = GetJWT(rUser,claims_arr);
                                                //res.send({state: "new", token: token});

                                                GetJWT(rUser, claims_arr, req.body.clientId, 'oauth-github',req, function (err, isSuccess, token) {

                                                    if (token) {

                                                        var sendObj = {
                                                            "company": config.Tenant.activeCompany,
                                                            "tenant": config.Tenant.activeTenant
                                                        };

                                                        sendObj.to = profile.email;
                                                        sendObj.from = "no-reply",
                                                            sendObj.template = "By-User Registration Success";
                                                        sendObj.Parameters = user;

                                                        PublishToQueue("EMAILOUT", sendObj);
                                                        return res.send({state: "existing", token: token});
                                                    } else {
                                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                                    }
                                                });


                                            } else {

                                                res.status(404).send({message: 'Organization save failed'});
                                            }
                                        })


                                    } else {
                                        res.status(404).send({message: 'User save failed'});

                                    }
                                });
                            }
                        });
                    } else {

                        User.findOne({"github.cid": profile.id}, function (err, existingUser) {
                            if (existingUser) {
                                //return res.send({state: 'existing', token: GetJWT(existingUser, claims_arr)});

                                Org.findOne({"companyName": companyName}, function (err, org) {
                                    if (err) {
                                        return res.status(401).send({message: 'Company verification failed'});
                                    }

                                    if (!org) {
                                        return res.status(401).send({message: 'Invalid organization name'});
                                    }

                                    if (org && org.companyEnabled) {
                                        UserAccount.findOne({
                                            "tenant": org.tenant,
                                            "company": org.id,
                                            "user": existingUser.username
                                        }, function (err, account) {
                                            if (err) {
                                                return res.status(401).send({message: 'User account verification failed'});
                                            }
                                            if (!account) {
                                                return res.status(401).send({message: 'Invalid user account'});
                                            }

                                            if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                && account.verified != true) {
                                                return res.status(401).send({message: 'User account is not verified'});
                                            }

                                            if (account.active != true) {
                                                return res.status(401).send({message: 'User account is not active'});
                                            }


                                            //user = user.toObject();
                                            existingUser._doc.tenant = org.tenant;
                                            existingUser._doc.company = org.id;
                                            existingUser.companyName = org.companyName;
                                            existingUser._doc.multi_login = account.multi_login;
                                            existingUser._doc.user_meta = account.user_meta;
                                            existingUser._doc.app_meta = account.app_meta;
                                            existingUser._doc.user_scopes = account.user_scopes;
                                            existingUser._doc.client_scopes = account.client_scopes;
                                            existingUser._doc.resourceid = account.resource_id;
                                            existingUser._doc.veeryaccount = account.veeryaccount;
                                            existingUser._doc.multi_login = account.multi_login;


                                            GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-github', req, function (err, isSuccess, token) {

                                                if (token) {
                                                    return res.send({state: "existing", token: token});
                                                } else {
                                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                                }
                                            });
                                        });
                                    }
                                });
                            } else {

                                user.github = {
                                    contact: profile.email,
                                    cid: profile.id,
                                    type: "github",
                                    display: profile.name,
                                    verified: true
                                };



                                user.avatar = user.avatar ||  profile.avatar_url;
                                user.displayname = user.displayname || profile.name;

                                user.save(function () {
                                    //var token = GetJWT(user,claims_arr);
                                    //res.send({state: "linking",token: token});

                                    GetJWT(user,claims_arr,req.body.clientId,'oauth-github',req,function(err, isSuccess, token){

                                        if(token){
                                            return res.send({state: "linking", token: token});
                                        }else{
                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                        }
                                    });
                                });


                            }
                        });

                    }
                });

            }
        });
    });
};

module.exports.Facebook = function(req, res) {
    var fields = ['id', 'email', 'first_name', 'last_name', 'link', 'name'];
    var accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token';
    var graphApiUrl = 'https://graph.facebook.com/v2.5/me?fields=' + fields.join(',');
    var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: config.auth.FACEBOOK_SECRET,
        redirect_uri: req.body.redirectUri
    };

    var companyName = req.body.companyname;
    var claims_arr = ["all_all"];
    if(req.body.scope && util.isArray(req.body.scope) && req.body.scope.length >0){

        claims_arr = req.body.scope;
    }
    // Step 1. Exchange authorization code for access token.
    request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {

        if(response) {
            if (response.statusCode !== 200) {
                return res.status(500).send({message: accessToken.error.message});
            }
        }else{
            return res.status(500).send({message: 'No response Found'});
        }

        // Step 2. Retrieve profile information about the current user.
        request.get({url: graphApiUrl, qs: accessToken, json: true}, function (err, response, profile) {
            if (response.statusCode !== 200) {

                return res.status(500).send({message: profile.error.message});
            }
            if (req.header('Authorization')) {


                User.findOne({"facebook.cid": profile.id}, function (err, existingUser) {
                    if (existingUser) {
                        return res.status(409).send({message: 'There is already a Google account that belongs to you'});
                    }
                    var token = req.header('Authorization').split(' ')[1];


                    GetVerification(token, function (err, payload) {

                        if (!err && payload) {
                            User.findOne({username: payload.iss}, function (err, user) {
                                if (!user) {
                                    return res.status(400).send({message: 'User not found'});
                                }

                                user.facebook = {
                                    contact: profile.email,
                                    cid: profile.id,
                                    type: "facebook",
                                    display: profile.name,
                                    verified: true
                                };

                                user.email = {
                                    contact: profile.email,
                                    type: "email",
                                    display: profile.name,
                                    verified: true
                                };
                                user.avatar = user.avatar || 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
                                user.displayname = user.displayname || profile.name;
                                user.firstname = user.firstname || profile.first_name;
                                user.lastname = user.lastname || profile.last_name;
                                //user.locale = user.locale || profile.locale,
                                user.save(function () {
                                    //var token = GetJWT(user,claims_arr);
                                    //res.send({state: "linking",token: token});


                                    Org.findOne({"companyName": companyName}, function (err, org) {
                                        if (err) {
                                            return res.status(401).send({message: 'Company verification failed'});
                                        }

                                        if (!org) {
                                            return res.status(401).send({message: 'Invalid organization name'});
                                        }

                                        if (org && org.companyEnabled) {
                                            UserAccount.findOne({
                                                "tenant": org.tenant,
                                                "company": org.id,
                                                "user": existingUser.username
                                            }, function (err, account) {
                                                if (err) {
                                                    return res.status(401).send({message: 'User account verification failed'});
                                                }
                                                if (!account) {
                                                    return res.status(401).send({message: 'Invalid user account'});
                                                }

                                                if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                    && account.verified != true) {
                                                    return res.status(401).send({message: 'User account is not verified'});
                                                }

                                                if (account.active != true) {
                                                    return res.status(401).send({message: 'User account is not active'});
                                                }


                                                //user = user.toObject();
                                                existingUser._doc.tenant = org.tenant;
                                                existingUser._doc.company = org.id;
                                                existingUser.companyName = org.companyName;
                                                existingUser._doc.multi_login = account.multi_login;
                                                existingUser._doc.user_meta = account.user_meta;
                                                existingUser._doc.app_meta = account.app_meta;
                                                existingUser._doc.user_scopes = account.user_scopes;
                                                existingUser._doc.client_scopes = account.client_scopes;
                                                existingUser._doc.resourceid = account.resource_id;
                                                existingUser._doc.veeryaccount = account.veeryaccount;
                                                existingUser._doc.multi_login = account.multi_login;


                                                GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-facebook', req, function (err, isSuccess, token) {

                                                    if (token) {
                                                        return res.send({state: "linking", token: token});
                                                    } else {
                                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                                    }
                                                });
                                            })
                                        }
                                    });
                                });
                            });
                        } else {

                            return res.status(401).send({message: 'Token is not verified'});
                        }

                    });
                });

            } else {
                // Step 3. Create a new user account or return an existing one.


                User.findOne({"username": profile.email}, function (err, user) {
                    if (!user) {
                        User.findOne({"facebook.cid": profile.id}, function (err, existingUser) {
                            if (existingUser) {
                                //return res.send({state: 'existing',token: GetJWT(existingUser, claims_arr)});

                                //////////////////////////////////////////////////////////////////////////////////////

                                Org.findOne({"companyName": companyName}, function (err, org) {
                                    if (err) {
                                        return res.status(401).send({message: 'Company verification failed'});
                                    }

                                    if (!org) {
                                        return res.status(401).send({message: 'Invalid organization name'});
                                    }

                                    if (org && org.companyEnabled) {
                                        UserAccount.findOne({
                                            "tenant": org.tenant,
                                            "company": org.id,
                                            "user": existingUser.username
                                        }, function (err, account) {
                                            if (err) {
                                                return res.status(401).send({message: 'User account verification failed'});
                                            }
                                            if (!account) {
                                                return res.status(401).send({message: 'Invalid user account'});
                                            }

                                            if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                && account.verified != true) {
                                                return res.status(401).send({message: 'User account is not verified'});
                                            }

                                            if (account.active != true) {
                                                return res.status(401).send({message: 'User account is not active'});
                                            }


                                            //user = user.toObject();
                                            existingUser._doc.tenant = org.tenant;
                                            existingUser._doc.company = org.id;
                                            existingUser.companyName = org.companyName;
                                            existingUser._doc.multi_login = account.multi_login;
                                            existingUser._doc.user_meta = account.user_meta;
                                            existingUser._doc.app_meta = account.app_meta;
                                            existingUser._doc.user_scopes = account.user_scopes;
                                            existingUser._doc.client_scopes = account.client_scopes;
                                            existingUser._doc.resourceid = account.resource_id;
                                            existingUser._doc.veeryaccount = account.veeryaccount;
                                            existingUser._doc.multi_login = account.multi_login;


                                            GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-facebook', req, function (err, isSuccess, token) {

                                                if (token) {
                                                    return res.send({state: "existing", token: token});
                                                } else {
                                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                                }
                                            });
                                        })
                                    }
                                });
                            } else {


                                var user = new User();
                                user.facebook = {
                                    contact: profile.email,
                                    cid: profile.id,
                                    type: "facebook",
                                    display: profile.name,
                                    verified: true
                                };

                                user.email = {
                                    contact: profile.email,
                                    type: "email",
                                    display: profile.name,
                                    verified: true
                                };

                                user.avatar = 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
                                user.displayName = profile.name;
                                user.firstname = profile.first_name;
                                user.lastname = profile.last_name;
                                //user.locale = profile.locale;
                                user.company = 0;
                                user.tenant = 1;
                                user.systemuser = true,
                                    user.username = profile.email;
                                user.user_meta = {role: "admin"};
                                user.user_scopes = [
                                    {scope: "organisation", read: true, write: true},
                                    {scope: "resource", read: true},
                                    {scope: "package", read: true},
                                    {scope: "console", read: true},
                                    {"scope": "myNavigation", "read": true},
                                    {"scope": "myUserProfile", "read": true}
                                ];


                                user.save(function (err) {

                                    if (!err) {
                                        var defaultTimezone = {tz: "", utcOffset: ""};

                                        orgService.CreateOrganisationStanAlone(user, companyName, defaultTimezone, function (err, rUser) {

                                            if (!err && rUser) {

                                                //var token = GetJWT(rUser,["all_all"]);
                                                //res.send({state: "new", token: token});
                                                //
                                                //var sendObj = {
                                                //    "company": 0,
                                                //    "tenant": 1
                                                //};
                                                //
                                                //sendObj.to =  profile.email;
                                                //sendObj.from = "no-reply",
                                                //    sendObj.template = "By-User Registration Success";
                                                //sendObj.Parameters = user
                                                //
                                                //PublishToQueue("EMAILOUT", sendObj)


                                                GetJWT(rUser, claims_arr, req.body.clientId, 'oauth-facebook', req, function (err, isSuccess, token) {

                                                    if (token) {

                                                        var sendObj = {
                                                            "company": config.Tenant.activeCompany,
                                                            "tenant": config.Tenant.activeTenant
                                                        };

                                                        sendObj.to = profile.email;
                                                        sendObj.from = "no-reply";
                                                        sendObj.template = "By-User Registration Success";
                                                        sendObj.Parameters = user;

                                                        PublishToQueue("EMAILOUT", sendObj);

                                                        return res.send({state: "new", token: token});
                                                    } else {
                                                        return res.status(401).send({message: 'Invalid email and/or password'});
                                                    }
                                                });


                                            } else {

                                                res.status(404).send({message: 'Organization save failed'});
                                            }
                                        });


                                    } else {
                                        res.status(404).send({message: 'User save failed'});

                                    }
                                });
                            }
                        });

                    } else {

                        User.findOne({"facebook.cid": profile.id}, function (err, existingUser) {
                            if (existingUser) {
                                //return res.send({state: 'existing', token: GetJWT(existingUser, claims_arr)});


                                Org.findOne({"companyName": companyName}, function (err, org) {
                                    if (err) {
                                        return res.status(401).send({message: 'Company verification failed'});
                                    }

                                    if (!org) {
                                        return res.status(401).send({message: 'Invalid organization name'});
                                    }

                                    if (org && org.companyEnabled) {
                                        UserAccount.findOne({
                                            "tenant": org.tenant,
                                            "company": org.id,
                                            "user": existingUser.username
                                        }, function (err, account) {
                                            if (err) {
                                                return res.status(401).send({message: 'User account verification failed'});
                                            }
                                            if (!account) {
                                                return res.status(401).send({message: 'Invalid user account'});
                                            }

                                            if ((config.auth.login_verification === true || config.auth.login_verification === 'true')
                                                && account.verified != true) {
                                                return res.status(401).send({message: 'User account is not verified'});
                                            }

                                            if (account.active != true) {
                                                return res.status(401).send({message: 'User account is not active'});
                                            }


                                            //user = user.toObject();
                                            existingUser._doc.tenant = org.tenant;
                                            existingUser._doc.company = org.id;
                                            existingUser.companyName = org.companyName;
                                            existingUser._doc.multi_login = account.multi_login;
                                            existingUser._doc.user_meta = account.user_meta;
                                            existingUser._doc.app_meta = account.app_meta;
                                            existingUser._doc.user_scopes = account.user_scopes;
                                            existingUser._doc.client_scopes = account.client_scopes;
                                            existingUser._doc.resourceid = account.resource_id;
                                            existingUser._doc.veeryaccount = account.veeryaccount;
                                            existingUser._doc.multi_login = account.multi_login;

                                            GetJWT(existingUser, claims_arr, req.body.clientId, 'oauth-facebook', req, function (err, isSuccess, token) {

                                                if (token) {
                                                    return res.send({state: "existing", token: token});
                                                } else {
                                                    return res.status(401).send({message: 'Invalid email and/or password'});
                                                }
                                            });
                                        });
                                    }
                                });

                            } else {
                                user.facebook = {
                                    contact: profile.email,
                                    cid: profile.id,
                                    type: "facebook",
                                    display: profile.name,
                                    verified: true
                                };


                                user.avatar = user.avatar || 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
                                user.displayname = user.displayname || profile.name;
                                user.firstname = user.firstname || profile.first_name;
                                user.lastname = user.lastname || profile.last_name;

                                user.save(function () {
                                    //var token = GetJWT(user, claims_arr);
                                    //res.send({state: "linking", token: token});

                                    GetJWT(user, claims_arr, req.body.clientId, 'oauth-facebook', req, function (err, isSuccess, token) {

                                        if (token) {
                                            return res.send({state: "linking", token: token});
                                        } else {
                                            return res.status(401).send({message: 'Invalid email and/or password'});
                                        }
                                    });
                                });
                            }
                        });

                    }
                });

            }
        });
    });
};

module.exports.ForgetPassword = function(req, res){


    var jsonString;

    if(req.body.email) {
        User.findOne({"email.contact": req.body.email}, function (err, existingUser) {
            if (!existingUser || err) {

                jsonString = messageFormatter.FormatMessage(undefined, "User not exists", false, undefined);
                res.end(jsonString);


            } else {

                crypto.randomBytes(20, function (err, buf) {
                    var token = buf.toString('hex');

                    var url = config.auth.ui_host + '#/reset/' + token;



                    redisClient.set("reset"+":"+token,existingUser._id ,function (err, val) {
                        if (err) {

                            jsonString = messageFormatter.FormatMessage(undefined, "Error in process", false, undefined);
                            res.end(jsonString);

                        }else{


                            redisClient.expireat("reset"+":"+token,  parseInt((+new Date)/1000) + 86400);
                            var sendObj = {
                                "company": config.Tenant.activeCompany,
                                "tenant": config.Tenant.activeTenant
                            };

                            //existingUser.url = url;

                            sendObj.to =  req.body.email;
                            sendObj.from = "no-reply";
                            sendObj.template = "By-User Reset Password";
                            sendObj.Parameters = {username: existingUser.username,
                                url: url};

                            PublishToQueue("EMAILOUT", sendObj);

                            jsonString = messageFormatter.FormatMessage(undefined, "Reset email send", true, undefined);
                            res.end(jsonString);
                        }
                    });

                });
            }
        });
    }else{

        jsonString = messageFormatter.FormatMessage(undefined, "Email is not valid", false, undefined);
        res.end(jsonString);
    }



};

module.exports.ForgetPasswordToken = function(req, res){


    var jsonString;

    if(req.body.email) {
        User.findOne({"email.contact": req.body.email}, function (err, existingUser) {
            if (!existingUser || err) {

                jsonString = messageFormatter.FormatMessage(undefined, "User not exists", false, undefined);
                res.end(jsonString);


            } else {

                crypto.randomBytes(20, function (err, buf) {
                    var token = buf.toString('hex');

                    var url = config.auth.ui_host + '#/reset/' + token;

                    redisClient.set("reset"+":"+token,existingUser._id.toString() ,function (err, val) {
                        if (err) {

                            jsonString = messageFormatter.FormatMessage(undefined, "Error in process", false, undefined);
                            res.end(jsonString);

                        }else{


                            redisClient.expireat("reset"+":"+token,  parseInt((+new Date)/1000) + 86400);
                            var sendObj = {
                                "company": config.Tenant.activeCompany,
                                "tenant": config.Tenant.activeTenant
                            };

                            //existingUser.url = url;

                            sendObj.to =  req.body.email;
                            sendObj.from = "no-reply";
                            sendObj.template = "By-User Reset Password Token";
                            sendObj.Parameters = {username: existingUser.username,
                                token: token};

                            PublishToQueue("EMAILOUT", sendObj);

                            jsonString = messageFormatter.FormatMessage(undefined, "Reset email send", true, undefined);
                            res.end(jsonString);
                        }
                    });

                });
            }
        });
    }else{

        jsonString = messageFormatter.FormatMessage(undefined, "Email is not valid", false, undefined);
        res.end(jsonString);
    }



};

module.exports.ResetPassword = function(req, res){


    var jsonString;

    redisClient.get("reset"+":"+req.params.token,function (err, val) {
        if (err ) {

            jsonString = messageFormatter.FormatMessage(err, "Error in process", false, undefined);
            res.end(jsonString);

        }else{

            if(val && req.body.password) {

                var newpwd;
                bcrypt.genSalt(10, function(err, salt) {
                    bcrypt.hash(req.body.password, salt, function(err, hash) {

                        if(!err) {
                            newpwd = hash;
                            User.findOneAndUpdate({"_id": val}, {password: newpwd}, function (err, existingUser) {
                                if (!existingUser || err) {

                                    jsonString = messageFormatter.FormatMessage(undefined, "User not exists", false, undefined);
                                    res.end(jsonString);


                                } else {
                                    var sendObj = {
                                        "company": config.Tenant.activeCompany,
                                        "tenant": config.Tenant.activeTenant
                                    };

                                    //existingUser.url = url;

                                    sendObj.to = existingUser.email.contact;
                                    sendObj.from = "no-reply";
                                    sendObj.template = "By-User Reset Password Success";
                                    sendObj.Parameters = {
                                        username: existingUser.username
                                    };

                                    PublishToQueue("EMAILOUT", sendObj);

                                    redisClient.del("reset" + ":" + req.params.token, redis.print);

                                    jsonString = messageFormatter.FormatMessage(undefined, "Reset email send", true, undefined);
                                    res.end(jsonString);

                                }
                            });
                        }else{

                            jsonString = messageFormatter.FormatMessage(undefined, "Error in process", false, undefined);
                            res.end(jsonString);
                        }

                    });
                });

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Error in process", false, undefined);
                res.end(jsonString);
            }
        }
    });

};

module.exports.ActivateAccount= function(req, res){


    var jsonString;

    redisClient.get("activate"+":"+req.params.token,function (err, val) {
        if (err ) {

            jsonString = messageFormatter.FormatMessage(err, "Error in process", false, undefined);
            res.end(jsonString);

        }else{

            if(val ) {


                User.findOneAndUpdate({"_id": val}, {"verified": true, "email.verified": true}, function (err, existingUser) {
                    if (!existingUser || err) {

                        jsonString = messageFormatter.FormatMessage(undefined, "User not exists", false, undefined);
                        res.end(jsonString);


                    } else {
                        var sendObj = {
                            "company": config.Tenant.activeCompany,
                            "tenant": config.Tenant.activeTenant
                        };

                        //existingUser.url = url;

                        sendObj.to = existingUser.email.contact;
                        sendObj.from = "no-reply";
                        sendObj.template = "By-User Account Activated";
                        sendObj.Parameters = {
                            username: existingUser.username
                        };

                        PublishToQueue("EMAILOUT", sendObj);

                        redisClient.del("activate" + ":" + req.params.token, redis.print);

                        jsonString = messageFormatter.FormatMessage(undefined, "Reset email send", true, undefined);
                        res.end(jsonString);

                    }
                });


            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Error in process", false, undefined);
                res.end(jsonString);
            }
        }
    });

};

module.exports.CheckToken = function(req, res) {


    var jsonString;

    redisClient.get("reset" + ":" + req.params.token, function (err, val) {
        if (err || !val) {

            jsonString = messageFormatter.FormatMessage(err, "Error in process", false, undefined);
            res.end(jsonString);

        } else {
            jsonString = messageFormatter.FormatMessage(undefined, "Token Found", true, undefined);
            res.end(jsonString);


        }
    });

};

module.exports.Attachments = function(req,res){

    var sendObj = {
        "company": config.Tenant.activeCompany,
        "tenant": config.Tenant.activeTenant
    };

    sendObj.to =  "pawan@duosoftware.com";
    sendObj.from = "no-reply";
    sendObj.template = "By-User Registration Confirmation";
    sendObj.Parameters = {username: "pawan",
        created_at: new Date(),
        url:"aaaa"}

    sendObj.attachments = [];
    var item = {
        "url": "http://fileservice.app.veery.cloud/DVP/API/1.0.0.0/InternalFileService/File/DownloadLatest/1/103/CDR_1_103_1476642600_1476728999.csv",
        "name": "cdr.csv"
    }

    sendObj.attachments.push(item);
    PublishToQueue("EMAILOUT", sendObj)

    res.end();

}
