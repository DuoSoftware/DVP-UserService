/**
 * Created by Heshan.i on 6/6/2016.
 */
var redis = require('ioredis');
var config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var Org = require('dvp-mongomodels/model/Organisation');
var User = require('dvp-mongomodels/model/User');
var VPackage = require('dvp-mongomodels/model/Package');
var PackageUnit = require('dvp-mongomodels/model/PackageUnit');
var Console = require('dvp-mongomodels/model/Console');
var EventEmitter = require('events').EventEmitter;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var util = require('util');
var restClientHandler = require('./RestClient.js');
var validator = require('validator');
var Tenant = require('dvp-mongomodels/model/Tenant').Tenant;
var dbConn = require('dvp-dbmodels');
var UserAccount = require('dvp-mongomodels/model/UserAccount');
var businessUnitService = require('./BusinessUnitService.js');
var externalUserService = require('./ExternalUserService.js');


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

var client = undefined;

if(redismode != "cluster") {
    client = new redis(redisSetting);
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

        var client = new redis.Cluster([redisSetting]);

    }else{

        client = new redis(redisSetting);
    }


}

client.on("error", function (err) {
    console.log("Error " + err);
});

function FilterObjFromArray(itemArray, field, value){
    var resultObj;
    if(itemArray) {
        for (var i = 0; i < itemArray.length; i++) {
            var item = itemArray[i];
            var qParams = field.split('.');
            if(qParams && qParams.length >1){
                var qData = item[qParams[0]];
                for(var j=1;j<qParams.length;j++){
                    if(qData) {
                        qData = qData[qParams[j]];
                    }
                }

                if (qData == value) {
                    resultObj = item;
                    break;
                }
            }else {
                if (item[field] == value) {
                    resultObj = item;
                    break;
                }
            }
        }
        return resultObj;
    }else{
        return undefined;
    }
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

function GetNewCompanyId(callback){
    client.incr("CompanyCount", function (err, result) {
        if (err) {
            callback(null);
        } else {
            callback(parseInt(result));
        }
    });
}

function SetCompanySpaceLimit(tenant, company, spaceType, limit){
    var spaceLimitKey = util.format('SpaceLimit:%d:%d:%s', tenant, company, spaceType);
    client.set(spaceLimitKey, JSON.stringify(limit), function (err, result) {
        if (err) {
            logger.error("Set Company space limit in redis failed: "+ err);
        } else {
            logger.error("Set Company space limit in redis success.");
        }
    });
}

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

function GetOrganisationsWithPaging(req, res){
    logger.debug("DVP-UserService.GetOrganisations Internal method ");

    var tenant = parseInt(req.user.tenant);
    var jsonString;


    var page = parseInt(req.params.page),
        size = parseInt(req.params.size),
        skip = page > 0 ? ((page - 1) * size) : 0;


    Org.find({tenant: tenant}).skip(skip)
        .limit(size).sort({created_at: -1}).exec(function(err, orgs) {
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
    var company;
    if(req.params.company){
        company = parseInt(req.params.company);
    }else {
        company = parseInt(req.user.company);
    }
    var jsonString;
    Org.findOne({tenant: tenant, id: company}).populate('tenantRef').populate({path: 'packageDetails.veeryPackage',populate : {path: 'Package'}}).populate('ownerRef' , '-password').exec( function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Successful", true, org);
        }
        res.end(jsonString);
    });
}


function IsOrganizationExists(req, res){
    logger.debug("DVP-UserService.IsOrganizationExists Internal method ");


    var jsonString;
   // Org.findOne({companyName: new RegExp(req.params.company,'i')}, function(err, org) {
    Org.findOne({companyName: req.params.company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
        }else{
            if(org) {
                jsonString = messageFormatter.FormatMessage(err, "Get Organisation Successful", true, org);
            }else{
                jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            }
        }
        res.end(jsonString);
    });
}


function GetOrganisationName(req, res){
    logger.debug("DVP-UserService.GetOrganisation Internal method ");

    var tenant = parseInt(req.params.tenant);
    var company = parseInt(req.params.company);
    var jsonString;
    Org.findOne({tenant: tenant, id: company},{companyName: 1}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Successful", true, org);
        }
        res.end(jsonString);
    });
}

function GetOrganisationPackages(req, res){
    logger.debug("DVP-UserService.GetOrganisationPackages Internal method ");

    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    var owner = req.user.iss;
    var jsonString;
    try {
        Org.findOne({ownerId: owner, tenant: tenant, id: company}, function (err, org) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            } else {

                if (org) {
                    jsonString = messageFormatter.FormatMessage(undefined, "Get Organisation packages Successful", true, org.packages);
                }
                else {

                    jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
                }

            }
            res.end(jsonString);
        });
    }catch(ex){
        console.log(ex);
    }
}

function GetOrganisationPackagesWithDetails(req, res){
    logger.debug("DVP-UserService.GetOrganisationPackagesWithDetails Internal method ");

    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);
    var owner = req.user.iss;
    var jsonString;
    Org.findOne({ownerId:owner, tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
        }else{

            if(org) {
                var cPackages = {packageInfo: org.packageDetails, unitInfo: org.unitDetails};
                jsonString = messageFormatter.FormatMessage(undefined, "Get Organisation packages Successful", true, cPackages);
            }
            else{

                jsonString = messageFormatter.FormatMessage(err, "Get Organisation Failed", false, undefined);
            }

        }
        res.end(jsonString);
    });
}

function DeleteOrganisation(req,res){
    logger.debug("DVP-UserService.DeleteOrganisation Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    UserAccount.find({tenant: tenant, id: company}, function(err, users) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get User Accounts Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(users.length>0){
                jsonString = messageFormatter.FormatMessage(undefined, "User Accounts are Available, Denied Remove Organisation", false, undefined);
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

// function CreateOwner(req, res){
//     var jsonString;
//     Tenant.findOne({id: config.Tenant.activeTenant}, function (err, Tenants) {
//         if (err) {
//
//             jsonString = messageFormatter.FormatMessage(err, "Find tenant failed", false, undefined);
//             res.end(jsonString);
//
//         } else {
//
//             if (Tenants) {
//                 var user = User({
//                     name: req.body.username,
//                     firstname: req.body.firstname,
//                     lastname: req.body.lastname,
//                     username: req.body.username,
//                     password: req.body.password,
//                     Active: true,
//                     phoneNumber: {contact: req.body.phone, type: "phone", verified: false},
//                     email: {contact: req.body.mail, type: "phone", verified: false},
//                     user_meta: {role: "admin"},
//                     systemuser: true,
//                     user_scopes: [{
//                         "scope": "package",
//                         "read": true
//                     }],
//                     company: 0,
//                     tenant: Tenants.id,
//                     created_at: Date.now(),
//                     updated_at: Date.now()
//
//                 });
//                 user.save(function (err, rUser) {
//                     if (err) {
//                         jsonString = messageFormatter.FormatMessage(err, "Create Owner failed", false, undefined);
//                         res.end(jsonString);
//                     } else {
//                         jsonString = messageFormatter.FormatMessage(undefined, "Create Owner successfully", true, rUser);
//                         res.end(jsonString);
//                     }
//                 });
//             } else {
//                 jsonString = messageFormatter.FormatMessage(undefined, "No tenants found", false, undefined);
//                 res.end(jsonString);
//             }
//         }
//     });
// }

var AssignPackageToOrganisationLib = function(company, tenant, packageName, requestedUser, addDefaultData, callback){
    logger.debug("DVP-UserService.AssignPackageToOrganisation Internal method ");
    logger.debug(packageName);

    var jsonString;

    VPackage.findOne({packageName: packageName}, function(err, vPackage) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Package Failed", false, undefined);
            callback(jsonString);
        }else{
            if(vPackage) {
                Org.findOne({
                    tenant: tenant,
                    id: company
                }).populate('tenantRef').populate({
                    path: 'packageDetails.veeryPackage',
                    populate: {path: 'Package'}
                }).populate('ownerRef', '-password').exec(function (err, org) {

                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
                        callback(jsonString);
                    } else {
                        if (org) {

                            if(org.ownerRef){

                                UserAccount.findOne({tenant: tenant, company: company, userref: org.ownerRef}).exec(function (err, userAccount) {

                                    if(err){
                                        jsonString = messageFormatter.FormatMessage(err, "Find Organisation Owner Failed", false, undefined);
                                        callback(jsonString);
                                    }else {

                                        var domainData = "127.0.0.1";
                                        if (org.tenantRef && org.tenantRef.rootDomain) {
                                            domainData = org.companyName + "." + org.tenantRef.rootDomain;

                                            if (org.packages.indexOf(packageName) == -1) {
                                                var billingObj = {
                                                    userInfo: requestedUser,
                                                    companyInfo: org,
                                                    name: vPackage.packageName,
                                                    type: vPackage.packageType,
                                                    category: "Veery Package",
                                                    setupFee: vPackage.setupFee ? vPackage.setupFee : 0,
                                                    unitPrice: vPackage.price,
                                                    units: 1,
                                                    description: vPackage.description,
                                                    date: Date.now(),
                                                    valid: true,
                                                    isTrial: false
                                                };

                                                var typeExist = FilterObjFromArray(org.packageDetails, 'veeryPackage.navigationType', vPackage.navigationType);
                                                if (typeExist) {

                                                    if (typeExist.veeryPackage.price <= vPackage.price) {

                                                        RequestToBill(org.id, org.tenant, billingObj, function (err, response) {
                                                            if (err) {
                                                                jsonString = messageFormatter.FormatMessage(err, "Error in Billing request", false, undefined);
                                                                callback(jsonString);
                                                            } else {
                                                                if (response) {
                                                                    if (response.IsSuccess) {
                                                                        try {
                                                                            org.packages.splice(org.packages.indexOf(typeExist.veeryPackage.packageName), 1);
                                                                        } catch (ex) {
                                                                            console.log("No Package Found in the list:: ", ex);
                                                                        }
                                                                        org.packages.push(packageName);
                                                                        org.packages = UniqueArray(org.packages);
                                                                        typeExist.veeryPackage = vPackage._id;
                                                                        typeExist.buyDate = Date.now();

                                                                        SetPackageToOrganisation(company, tenant, domainData, vPackage, org, userAccount._id, addDefaultData, function (jsonResponse) {
                                                                            callback(jsonResponse);
                                                                        });
                                                                    } else {
                                                                        jsonString = messageFormatter.FormatMessage(undefined, response.CustomMessage, false, undefined);
                                                                        callback(jsonString);
                                                                    }
                                                                } else {
                                                                    jsonString = messageFormatter.FormatMessage(err, "Error in Billing request", false, undefined);
                                                                    callback(jsonString);
                                                                }
                                                            }
                                                        });

                                                    } else {
                                                        jsonString = messageFormatter.FormatMessage(undefined, "Cannot downgrade package, Please contact your system administrator", false, undefined);
                                                        callback(jsonString);
                                                    }

                                                } else {
                                                    org.updated_at = Date.now();
                                                    org.packages.push(packageName);
                                                    org.packages = UniqueArray(org.packages);
                                                    org.packageDetails.push({veeryPackage: vPackage._id, buyDate: Date.now()});

                                                    if (vPackage.price > 0) {
                                                        RequestToBill(org.id, org.tenant, billingObj, function (err, response) {
                                                            if (err) {
                                                                jsonString = messageFormatter.FormatMessage(err, "Error in Billing request", false, undefined);
                                                                callback(jsonString);
                                                            } else {
                                                                if (response) {
                                                                    if (response.IsSuccess) {
                                                                        SetPackageToOrganisation(company, tenant, domainData, vPackage, org, userAccount._id, addDefaultData, function (jsonResponse) {
                                                                            callback(jsonResponse);
                                                                        });
                                                                    } else {
                                                                        jsonString = messageFormatter.FormatMessage(undefined, response.CustomMessage, false, undefined);
                                                                        callback(jsonString);
                                                                    }
                                                                } else {
                                                                    jsonString = messageFormatter.FormatMessage(err, "Error in Billing request", false, undefined);
                                                                    callback(jsonString);
                                                                }
                                                            }
                                                        });
                                                    } else {
                                                        SetPackageToOrganisation(company, tenant, domainData, vPackage, org, userAccount._id, addDefaultData, function (jsonResponse) {
                                                            callback(jsonResponse);
                                                        });
                                                    }
                                                }
                                            } else {
                                                jsonString = messageFormatter.FormatMessage(err, "Package Already Added", false, undefined);
                                                callback(jsonString);
                                            }

                                        } else {
                                            jsonString = messageFormatter.FormatMessage(err, "No Tenant Data Found", false, undefined);
                                            callback(jsonString);
                                        }

                                    }
                                });

                            }else {
                                jsonString = messageFormatter.FormatMessage(err, "Find Organisation Owner Failed", false, undefined);
                                callback(jsonString);
                            }

                        } else {
                            jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
                            callback(jsonString);
                        }
                    }

                });
            }else{
                jsonString = messageFormatter.FormatMessage(err, "Find Packahe Failed", false, undefined);
                callback(jsonString);
            }
        }
    });
};

// function CreateOrganisation(req, res){
//     logger.debug("DVP-UserService.CreateOrganisation Internal method ");
//     var jsonString;
//     GetNewCompanyId(function(cid){
//         if(cid && cid > 0) {
//
//             User.findOne({username: req.user.username}).select("-password").exec(function(err, user) {
//                 if (err) {
//                     jsonString = messageFormatter.FormatMessage(err, "Invalid User", false, undefined);
//                     res.end(jsonString);
//                 }else{
//                     if(user.company == 0){
//
//                         Tenant.findOne({id: config.Tenant.activeTenant},function(err, Tenants) {
//                             if (err) {
//
//                                 jsonString = messageFormatter.FormatMessage(err, "Get Tenant Failed", false, undefined);
//
//                             }else {
//
//                                 if (Tenants) {
//
//
//                                     var org = Org({
//                                         ownerId: req.user.username,
//                                         companyName: req.body.organisationName,
//                                         companyEnabled: true,
//                                         id: cid,
//                                         tenant: Tenants.id,
//                                         packages:[],
//                                         packageDetails: [],
//                                         unitDetails: [],
//                                         consoleAccessLimits:[],
//                                         resourceAccessLimits:[],
//                                         spaceLimit: [],
//                                         tenantRef:Tenants._id,
//                                         ownerRef: user._id,
//                                         created_at: Date.now(),
//                                         updated_at: Date.now(),
//                                         timeZone: req.body.timeZone
//                                     });
//                                     user.user_meta = {role: "admin"};
//                                     user.user_scopes =[
//                                         {scope: "organisation", read: true, write: true},
//                                         {scope: "resource", read: true},
//                                         {scope: "package", read: true},
//                                         {scope: "console", read: true},
//                                         {"scope": "myNavigation", "read": true},
//                                         {"scope": "myUserProfile", "read": true}
//                                     ];
//                                     user.company = cid;
//                                     user.updated_at = Date.now();
//                                     org.save(function (err, org) {
//                                         if (err) {
//                                             jsonString = messageFormatter.FormatMessage(err, "Organisation save failed", false, undefined);
//                                             res.end(jsonString);
//                                         } else {
//                                             User.findOneAndUpdate({username: req.user.username}, user, function (err, rUser) {
//                                                 if (err) {
//                                                     org.remove(function (err) {
//                                                     });
//                                                     rUser.company = cid;
//                                                     AssignPackageToOrganisationLib(cid, Tenants.id, "BASIC", rUser, function(jsonString){
//                                                         console.log(jsonString);
//                                                     });
//
//                                                     jsonString = messageFormatter.FormatMessage(err, "Update Admin User Failed", false, undefined);
//                                                     res.end(jsonString);
//                                                 } else {
//                                                     jsonString = messageFormatter.FormatMessage(undefined, "Organisation saved successfully", true, org);
//                                                     res.end(jsonString);
//                                                 }
//                                             });
//                                         }
//                                     });
//
//                                 }else{
//
//                                     jsonString = messageFormatter.FormatMessage(undefined, "No Tenant Found", false, undefined);
//                                     res.end(jsonString);
//
//                                 }
//                             }
//
//
//                         });
//
//                     }else{
//                         jsonString = messageFormatter.FormatMessage(err, "User Already Assign To an Organisation", false, undefined);
//                         res.end(jsonString);
//                     }
//                 }
//             });
//
//             //user.save(function (err, user) {
//             //    if (err) {
//             //        jsonString = messageFormatter.FormatMessage(err, "User save failed", false, undefined);
//             //        res.end(jsonString);
//             //    } else {
//             //        org.save(function (err, org) {
//             //            if (err) {
//             //                user.remove(function (err) {
//             //                });
//             //                jsonString = messageFormatter.FormatMessage(err, "Organisation save failed", false, undefined);
//             //            } else {
//             //                jsonString = messageFormatter.FormatMessage(undefined, "Organisation saved successfully", true, org);
//             //            }
//             //            res.end(jsonString);
//             //        });
//             //    }
//             //});
//         }else{
//             jsonString = messageFormatter.FormatMessage(undefined, "Create new organisation id failed", false, undefined);
//             res.end(jsonString);
//         }
//     });
// }

function UpdateOrganisation(req, res){
    logger.debug("DVP-UserService.UpdateOrganisation Internal method ");

    var company = req.params.company? parseInt(req.params.company): parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    if(req.body.companyName) {
        Org.findOneAndUpdate({tenant: tenant, id: company}, {companyName: req.body.companyName, timeZone: req.body.timeZone}, function (err, org) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Update Organisation Failed", false, undefined);
            } else {
                jsonString = messageFormatter.FormatMessage(err, "Update Organisation Successful", true, org);
            }
            res.end(jsonString);
        });
    }else{
        jsonString = messageFormatter.FormatMessage(undefined, "Update Organisation Failed", false, undefined);
    }
}

function ActivateOrganisation(req, res){
    logger.debug("DVP-UserService.ActivateOrganisation Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    company = req.params.company? parseInt(req.params.company): company;

    var state = req.params.state;

    var updated_at = Date.now();
    Org.findOneAndUpdate({tenant: tenant, id: company}, {companyEnabled : state, updated_at : updated_at}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Activate Organisation Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(err, "Activate Organisation Successful", true, org);
        }
        res.end(jsonString);
    });
};


var SetPackageToOrganisation = function(company, tenant, domainData, vPackage, org, userAccountId, addDefaultData, callback){
    var jsonString;

    if(vPackage.spaceLimit && vPackage.spaceLimit.length >0){
        var spaceLimitsToAdd = [];
        vPackage.spaceLimit.forEach(function (sLimit) {
            var existingSpaceLimit = org.spaceLimit.filter(function (esl) {
                return esl && sLimit &&  esl.spaceType === sLimit.spaceType;
            });

            if(existingSpaceLimit && existingSpaceLimit.length > 0){
                if(existingSpaceLimit[0].spaceLimit < sLimit.spaceLimit) {
                    existingSpaceLimit[0].spaceLimit = sLimit.spaceLimit;
                    SetCompanySpaceLimit(tenant,company, sLimit.spaceType, existingSpaceLimit[0]);
                }
            }else{
                spaceLimitsToAdd.push(sLimit);
                SetCompanySpaceLimit(tenant,company, sLimit.spaceType, sLimit);
            }
        });

        if(spaceLimitsToAdd && spaceLimitsToAdd.length >0) {
            org.spaceLimit = org.spaceLimit.concat(spaceLimitsToAdd);
        }
    }

    if (vPackage.consoleAccessLimit && vPackage.consoleAccessLimit.length > 0) {
        for (var i = 0; i < vPackage.consoleAccessLimit.length; i++) {
            var vCal = vPackage.consoleAccessLimit[i];
            var tempCal = {
                accessType: vCal.accessType,
                accessLimit: vCal.accessLimit,
                currentAccess: []
            };
            var count = 0;
            if (org.consoleAccessLimits.length > 0) {
                for (var j = 0; j < org.consoleAccessLimits.length; j++) {
                    count++;
                    var cal = org.consoleAccessLimits[j];
                    if (cal.accessType == vCal.accessType) {
                        org.consoleAccessLimits[j].accessLimit = tempCal.accessLimit;
                        break;
                    }
                    if (count == org.consoleAccessLimits.length) {
                        org.consoleAccessLimits.push(tempCal);

                        if (vCal.accessType == "admin") {
                            tempCal.currentAccess.push(org.ownerId);
                        }
                    }
                }
            } else {
                org.consoleAccessLimits.push(tempCal);
            }
        }
    }

    var er = ExtractResources(vPackage.resources);
    er.on('endExtractResources', function (userScopes) {
        if (userScopes) {
            for (var i = 0; i < userScopes.length; i++) {
                var scopes = userScopes[i];
                var eUserScope = FilterObjFromArray(org.resourceAccessLimits, "scopeName", scopes.scope);

                if (!org.resourceAccessLimits) {
                    org.resourceAccessLimits = [];
                }

                if (eUserScope) {
                    if (eUserScope.accessLimit != -1 && eUserScope.accessLimit < scopes.accessLimit) {
                        eUserScope.accessLimit = scopes.accessLimit;
                    }
                } else {
                    var rLimit = {
                        "scopeName": scopes.scope,
                        "accessLimit": scopes.accessLimit
                    };
                    org.resourceAccessLimits.push(rLimit);
                }
            }
        }


        Org.findOneAndUpdate({tenant: tenant, id: company}, org, function (err, rOrg) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Assign Package to Organisation Failed", false, undefined);
            } else {
                // UpdateUser(org.ownerId, vPackage);
                UpdateUser(userAccountId, vPackage);
                AssignTaskToOrganisation(company, tenant, vPackage.veeryTask);
                if(addDefaultData)
                {
                    AssignContextAndCloudEndUserToOrganisation(company, tenant, domainData);
                    AddDefaultRule(company, tenant);
                    AddDefaultTicketTypes(company, tenant);
                    AddDefaultFileCategories(company, tenant);
                    businessUnitService.AddDefaultBusinessUnit(company, tenant, org.ownerRef.id);
                    externalUserService.AddDefaultAccessibleFields(company, tenant);

                }
                jsonString = messageFormatter.FormatMessage(err, "Assign Package to Organisation Successful", true, org);
            }
            callback(jsonString);
        });
    });
};

function AssignPackageToOrganisation(req,res){
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var orgId;

    if(req.params.company){
        orgId = parseInt(req.params.company);
    }else{
        orgId = company;
    }

    var jsonString;

    UserAccount.findOne({tenant: tenant, company: company, user: req.user.iss}).populate('userref' , '-password').exec(function (err, userAccount) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Error in User Search", false, undefined);
            res.end(jsonString);
        } else {
            if(userAccount) {
                AssignPackageToOrganisationLib(orgId, tenant, req.params.packageName, userAccount.userref, false, function (jsonString) {
                    res.end(jsonString);
                });
            }else{
                jsonString = messageFormatter.FormatMessage(undefined, "No User Found.", false, undefined);
                res.end(jsonString);
            }
        }
    });


}

function AssignTaskToOrganisation(company, tenant, taskList){
    var taskInfoUrl = util.format("http://%s/DVP/API/%s/ResourceManager/TaskInfo",config.Services.resourceServiceHost, config.Services.resourceServiceVersion);
    var taskUrl = util.format("http://%s/DVP/API/%s/ResourceManager/Task",config.Services.resourceServiceHost, config.Services.resourceServiceVersion);
    if(validator.isIP(config.Services.resourceServiceHost))
    {
        taskUrl = util.format("http://%s:%s/DVP/API/%s/ResourceManager/Task", config.Services.resourceServiceHost, config.Services.resourceServicePort, config.Services.resourceServiceVersion);
        taskInfoUrl = util.format("http://%s:%s/DVP/API/%s/ResourceManager/TaskInfo", config.Services.resourceServiceHost, config.Services.resourceServicePort, config.Services.resourceServiceVersion);
    }
    var companyInfo = util.format("%d:%d", tenant, company);
    restClientHandler.DoGet(companyInfo, taskInfoUrl, "", function (err, res1, result) {
        if (err) {
            console.log(err);
        }
        else {
            var jResult = JSON.parse(result);
            for(var i in taskList) {
                var task = FilterObjFromArray(jResult.Result,"TaskType",taskList[i]);
                if(task) {
                    var body = {"TaskInfoId": task.TaskInfoId};
                    if(task.TaskType == "CALL" || task.TaskType == "CHAT"){
                        body.AddToProductivity = true;
                    }else{
                        body.AddToProductivity = false;
                    }
                    restClientHandler.DoPost(companyInfo, taskUrl, body, function (err, res1, result) {
                        if (err) {
                            console.log(err);
                        }
                        else {
                            console.log("Assign Task Success");
                        }
                    });
                }
            }
        }
    });
}

function AssignContextAndCloudEndUserToOrganisation(company, tenant, domain){
    var contextUrl = util.format("http://%s/DVP/API/%s/SipUser/Context",config.Services.sipuserendpointserviceHost, config.Services.sipuserendpointserviceVersion);
    var transferCodesUrl = util.format("http://%s/DVP/API/%s/SipUser/TransferCode",config.Services.sipuserendpointserviceHost, config.Services.sipuserendpointserviceVersion);
    var cloudEndUserUrl = util.format("http://%s/DVP/API/%s/CloudConfiguration/DefaultCloudEndUser",config.Services.clusterconfigserviceHost, config.Services.clusterconfigserviceVersion);
    if(validator.isIP(config.Services.sipuserendpointserviceHost))
    {
        contextUrl = util.format("http://%s:%s/DVP/API/%s/SipUser/Context", config.Services.sipuserendpointserviceHost, config.Services.sipuserendpointservicePort, config.Services.sipuserendpointserviceVersion);
        transferCodesUrl = util.format("http://%s:%s/DVP/API/%s/SipUser/TransferCode",config.Services.sipuserendpointserviceHost, config.Services.sipuserendpointservicePort, config.Services.sipuserendpointserviceVersion);
    }

    if(validator.isIP(config.Services.clusterconfigserviceHost))
    {
        cloudEndUserUrl = util.format("http://%s:%s/DVP/API/%s/CloudConfiguration/DefaultCloudEndUser", config.Services.clusterconfigserviceHost, config.Services.clusterconfigservicePort, config.Services.clusterconfigserviceVersion);
    }

    var companyInfo = util.format("%d:%d", tenant, company);
    var contextReqBody = {
        ContextCat: 'INTERNAL',
        Context: util.format("%d_%d_CONTEXT",tenant, company),
        Description: 'Default Internal Context',
        ClientTenant: tenant,
        ClientCompany: company

    };
    restClientHandler.DoPost(companyInfo, contextUrl, contextReqBody, function (err, res1, result) {
        if (err) {
            console.log(err);
        }
        else {
            var provision = 1;

            var companyInfoForCloudEndUser = util.format("%d:%d", 1, 1);

            if(config.ClusterName)
            {
                if(config.Provision)
                {
                    provision = config.Provision;
                }

                var cloudEndUserReqBody = {
                    ClusterName: config.ClusterName,
                    Domain: domain,
                    Provision: provision,
                    ClientTenant: tenant,
                    ClientCompany: company
                };
                console.log("Assign context Success: ", result);
                restClientHandler.DoPost(companyInfoForCloudEndUser, cloudEndUserUrl, cloudEndUserReqBody, function (err, res1, result) {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        console.log("Assign cloudEndUser Success: ", result);
                    }
                });

                var transferCodesBody = {
                    InternalTransfer: 3,
                    ExternalTransfer: 6,
                    GroupTransfer: 4,
                    ConferenceTransfer: 5
                };

                restClientHandler.DoPost(companyInfo, transferCodesUrl, transferCodesBody, function (err, res1, result) {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        console.log("Assign transfer codes Success: ", result);
                    }
                });
            }
            else
            {
                console.log("Cluster Code not set");
            }


        }
    });
}

function AddDefaultRule(company, tenant){
    var ruleserviceUrl = util.format("http://%s/DVP/API/%s/CallRuleApi/DefaultRule",config.Services.ruleserviceHost, config.Services.ruleserviceVersion);

    if(validator.isIP(config.Services.ruleserviceHost))
    {
        ruleserviceUrl = util.format("http://%s:%s/DVP/API/%s/CallRuleApi/DefaultRule",config.Services.ruleserviceHost, config.Services.ruleservicePort, config.Services.ruleserviceVersion);
    }
    var compInfo = util.format("%d:%d", tenant, company);
    restClientHandler.DoPost(compInfo, ruleserviceUrl, null, function (err, res1, result) {
        if (err)
        {
            console.log(err);
        }
        else
        {
            console.log("Add default rule result : ", result);
        }
    });
}

function AddDefaultFileCategories(company, tenant){

    var arr ={FileCategories: [
            {Category: 'CONVERSATION', Owner: "user", Visible: true, Encripted: true},
            {Category: 'VOICEMAIL', Owner: "user", Visible: true, Encripted: false},
            {Category: 'HOLDMUSIC', Owner: "user", Visible: true, Encripted: false},
            {Category: 'IVRCLIPS', Owner: "user", Visible: true, Encripted: false},
            {Category: 'TICKET_ATTACHMENTS', Owner: "user", Visible: true, Encripted: false},
            {Category: 'REPORTS', Owner: "user", Visible: true, Encripted: false},
            {Category: 'PROFILE_PICTURES', Owner: "user", Visible: true, Encripted: false},
            {Category: 'NOTICE_ATTACHMENTS', Owner: "user", Visible: true, Encripted: false},
            {Category: 'CHAT_ATTACHMENTS', Owner: "user", Visible: true, Encripted: false},
            {Category: 'FAX', Owner: "user", Visible: true, Encripted: false},
            {Category: 'EMAIL_ATTACHMENTS', Owner: "user", Visible: true, Encripted: false},
            {Category: 'AGENT_GREETINGS', Owner: "user", Visible: true, Encripted: false}
        ]};

    var fileserviceUrl = util.format("http://%s/DVP/API/%s/FileService/FileCategory/Bulk",config.Services.fileserviceHost, config.Services.fileserviceVersion);

    if(validator.isIP(config.Services.fileserviceHost))
    {
        fileserviceUrl = util.format("http://%s:%s/DVP/API/%s/FileService/FileCategory/Bulk",config.Services.fileserviceHost, config.Services.fileservicePort, config.Services.fileserviceVersion);
    }
    var compInfo = util.format("%d:%d", tenant, company);
    restClientHandler.DoPost(compInfo, fileserviceUrl, arr, function (err, res1, result) {
        if (err)
        {
            console.log(err);
        }
        else
        {
            console.log("Add file categories result : ", result);
        }
    });
}

function AddDefaultTicketTypes(company, tenant){
    var ticketserviceUrl = util.format("http://%s/DVP/API/%s/TicketTypes",config.Services.liteticketHost, config.Services.liteticketVersion);

    if(validator.isIP(config.Services.liteticketHost))
    {
        ticketserviceUrl = util.format("http://%s:%s/DVP/API/%s/TicketTypes",config.Services.liteticketHost, config.Services.liteticketPort, config.Services.liteticketVersion);
    }
    var compInfo = util.format("%d:%d", tenant, company);

    var obj = {
        custom_types: []
    };
    restClientHandler.DoPost(compInfo, ticketserviceUrl, obj, function (err, res1, result) {
        if (err)
        {
            console.log(err);
        }
        else
        {
            console.log("Add default ticket types : ", result);
        }
    });
}

function RemovePackageFromOrganisation(req,res){
    logger.debug("DVP-UserService.RemovePackageFromOrganisation Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    Org.findOne({tenant: tenant, id: company}, function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
            res.end(jsonString);
        }else{
            if(org) {
                org.updated_at = Date.now();
                for (var i = 0; i < org.packages.length; i++) {
                    if (org.packages[i].search(req.params.packageName) != -1) {
                        org.packages.splice(i, 1);
                    }
                }
                VPackage.findOne({packageName: req.params.packageName}, function(err, vPackage) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Get Package Failed", false, undefined);
                        console.log(jsonString);
                    } else {
                        //var tempSpaceLimit = vPackage.spaceLimit? vPackage.spaceLimit: 0;
                        //org.spaceLimit = org.spaceLimit - tempSpaceLimit;
                        //org.spaceLimit = org.spaceLimit < 0? 0:org.spaceLimit;



                        if(vPackage.spaceLimit && vPackage.spaceLimit.length >0){
                            vPackage.spaceLimit.forEach(function (sLimit) {
                                var existingSpaceLimit = org.spaceLimit.filter(function (esl) {
                                    return esl.spaceType === sLimit.spaceType;
                                });

                                if(existingSpaceLimit && existingSpaceLimit.length > 0){
                                    existingSpaceLimit[0].spaceLimit = existingSpaceLimit[0].spaceLimit - sLimit.spaceLimit;
                                    SetCompanySpaceLimit(tenant,company, sLimit.spaceType, existingSpaceLimit[0]);
                                }
                            });
                        }


                        for(var i in vPackage.consoleAccessLimit){
                            var vCal = vPackage.consoleAccessLimit[i];
                            var tempCal = {accessType: vCal.accessType, accessLimit: vCal.accessLimit, currentAccess: []};
                            for (var j in org.consoleAccessLimits) {
                                var cal = org.consoleAccessLimits[j];
                                if (cal.accessType == vCal.accessType) {
                                    org.consoleAccessLimits[j].accessLimit = org.consoleAccessLimits[j].accessLimit - tempCal.accessLimit;
                                    break;
                                }
                            }
                        }

                        Org.findOneAndUpdate({tenant: tenant, id: company}, org, function (err, rorg) {
                            if (err) {
                                jsonString = messageFormatter.FormatMessage(err, "Remove Package to Organisation Failed", false, undefined);
                            } else {
                                ///TODO: Remove Limits
                                jsonString = messageFormatter.FormatMessage(err, "Remove Package to Organisation Successful", true, org);
                            }
                            res.end(jsonString);
                        });
                    }
                });
            }else{
                jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
                res.end(jsonString);
            }
        }
    });
}

function GetUserScopes(scopes){
    var e = new EventEmitter();
    process.nextTick(function () {
        if (scopes && Array.isArray(scopes)) {
            var count = 0;
            for (var i =0; i < scopes.length; i++) {
                count++;
                var userScope = {};
                var oScope = scopes[i];
                if(oScope) {
                    userScope.scope = oScope.scopeName;
                    userScope.accessLimit = oScope.limit;
                    if(oScope.actions) {
                        for (var j = 0; j < oScope.actions.length; j++) {
                            var action = oScope.actions[j];
                            if (action) {
                                switch (action) {
                                    case 'read':
                                        userScope.read = true;
                                        break;
                                    case 'write':
                                        userScope.write = true;
                                        break;
                                    case 'delete':
                                        userScope.delete = true;
                                        break;
                                }
                            }
                        }
                    }
                    if(userScope) {
                        e.emit('getUserScopes', userScope);
                    }
                }
                if(count == scopes.length){
                    e.emit('endGetUserScopes');
                }
            }
        }else {
            e.emit('endGetUserScopes');
        }
    });

    return (e);
}

function ExtractResources(resources){
    var e = new EventEmitter();
    process.nextTick(function () {
        if (resources && Array.isArray(resources) && resources.length > 0) {
            var count = 0;
            var userScopes = [];
            for (var i = 0; i< resources.length; i++) {
                var resource = resources[i];
                var gus  = GetUserScopes(resource.scopes);
                gus.on('getUserScopes', function(scope){
                    if(scope){
                        userScopes.push(scope);
                    }
                });
                gus.on('endGetUserScopes', function(){
                    count++;
                    if(count == resources.length){
                        e.emit('endExtractResources', userScopes);
                    }
                });
            }
        }else {
            e.emit('endExtractResources', []);
        }
    });

    return (e);
}

function ExtractConsoles(consoles, navigationType){
    var e = new EventEmitter();
    process.nextTick(function () {
        if (consoles && Array.isArray(consoles)) {
            logger.debug("consoles Length: "+ consoles.length);
            var count = 0;
            var consoleScopes = [];
            for (var i = 0; i< consoles.length;i++) {
                var consoleName = consoles[i];
                logger.debug("consoleName: "+ consoleName);
                Console.findOne({consoleName: consoleName}, function(err, rConsole) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Get Console Failed", false, undefined);
                        console.log(jsonString);
                    }else{
                        if(rConsole) {
                            logger.debug("Result consoleName: " + rConsole.consoleName);
                            var consoleScope = {consoleName: rConsole.consoleName, menus: []};
                            if(rConsole.consoleNavigation) {
                                for (var j = 0; j < rConsole.consoleNavigation.length; j++) {
                                    var navigation = rConsole.consoleNavigation[j];
                                    if (navigation && navigation.navigationName && navigation.resources && navigation.navigationTypes.indexOf(navigationType)>-1) {
                                        var menuScope = {menuItem: navigation.navigationName, menuAction: []};
                                        for (var k = 0; k < navigation.resources.length; k++) {
                                            var navigationResource = navigation.resources[k];
                                            if (navigationResource && navigationResource.scopes) {
                                                for (var l = 0; l < navigationResource.scopes.length; l++) {
                                                    var navigationResourceScope = navigationResource.scopes[l];
                                                    if (navigationResourceScope) {
                                                        var scope = {
                                                            scope: navigationResourceScope.scopeName,
                                                            feature: navigationResourceScope.feature
                                                        };
                                                        if(navigationResourceScope.actions) {
                                                            for (var m = 0; m < navigationResourceScope.actions.length; m++) {
                                                                var action = navigationResourceScope.actions[m];
                                                                if (action) {
                                                                    switch (action) {
                                                                        case 'read':
                                                                            scope.read = true;
                                                                            break;
                                                                        case 'write':
                                                                            scope.write = true;
                                                                            break;
                                                                        case 'delete':
                                                                            scope.delete = true;
                                                                            break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        if (scope) {
                                                            menuScope.menuAction.push(scope);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        consoleScope.menus.push(menuScope);
                                    }
                                }
                            }
                            count++;
                            consoleScopes.push(consoleScope);
                        }
                    }

                    if(count == consoles.length){
                        e.emit('endExtractConsoles',consoleScopes);
                    }
                });
            }
        }else {
            e.emit('endExtractConsoles',[]);
        }
    });

    return (e);
}

function UpdateUser(userAccountId, vPackage){
    var jsonString;
    UserAccount.findOne({_id: userAccountId}, function(err, userAccount) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Find User Account Failed", false, undefined);
            return jsonString;
        } else {
            var fixUserScopes = [
                {scope: "user", read: true, write: true, delete: true},
                {scope: "userProfile", read: true, write: true, delete: true},
                {scope: "organisation", read: true, write: true},
                {scope: "resource", read: true},
                {scope: "package", read: true},
                {scope: "console", read: true},
                {scope: "userScope", read: true, write: true, delete: true},
                {scope: "userAppScope", read: true, write: true, delete: true},
                {scope: "userMeta", read: true, write: true, delete: true},
                {scope: "userAppMeta", read: true, write: true, delete: true},
                {scope: "client", read: true, write: true, delete: true},
                {scope: "clientScope", read: true, write: true, delete: true}
            ];
            var er = ExtractResources(vPackage.resources);
            er.on('endExtractResources', function(userScopes){
                userScopes = userScopes.concat(fixUserScopes);
                var uScopes = UniqueObjectArray(userScopes,"scope");
                if(uScopes) {
                    for (var i = 0; i < uScopes.length; i++) {
                        var eUserScope = FilterObjFromArray(userAccount.user_scopes, "scope", uScopes[i].scope);
                        if (eUserScope) {
                            if (uScopes[i].read && (!eUserScope.read || eUserScope.read == false)) {
                                eUserScope.read = uScopes[i].read;
                            }
                            if (uScopes[i].write && (!eUserScope.write || eUserScope.write == false)) {
                                eUserScope.write = uScopes[i].write;
                            }
                            if (uScopes[i].delete && (!eUserScope.delete || eUserScope.delete == false)) {
                                eUserScope.delete = uScopes[i].read;
                            }
                        } else {
                            userAccount.user_scopes.push(uScopes[i]);
                        }
                    }
                }
                var ec = ExtractConsoles(vPackage.consoles, vPackage.navigationType);
                ec.on('endExtractConsoles', function(clientScopes){
                    if(clientScopes) {
                        for (var j = 0; j < clientScopes.length; j++) {
                            if(userAccount.client_scopes && userAccount.client_scopes.length > 0) {
                                var existingClientScope = FilterObjFromArray(userAccount.client_scopes, "consoleName", clientScopes[j].consoleName);

                                if(existingClientScope){
                                    clientScopes[j].menus.forEach(function (cScopeMenu) {
                                        if(cScopeMenu){

                                            existingClientScope.menus.push(cScopeMenu);
                                        }
                                    });
                                }else{
                                    userAccount.client_scopes.push(clientScopes[j]);
                                }
                            }else {
                                userAccount.client_scopes.push(clientScopes[j]);
                            }
                        }
                    }

                    userAccount.client_scopes = UniqueObjectArray(userAccount.client_scopes,"consoleName");
                    if(userAccount.client_scopes) {
                        for (var k = 0; k < userAccount.client_scopes.length; k++) {
                            var ucs = userAccount.client_scopes[k];
                            ucs.menus = UniqueObjectArray(ucs.menus, "menuItem");
                            if(ucs.menus) {
                                for (var l = 0; l < ucs.menus.length; l++) {
                                    var menu1 = ucs.menus[l];
                                    if(menu1) {
                                        for (var m = 0; m < menu1.menuAction.length; m++) {
                                            var menuAction = FilterObjFromArray(userAccount.user_scopes, "scope", menu1.menuAction[m].scope);
                                            if (menuAction) {
                                                if (menu1.menuAction[m].read) {
                                                    menuAction.read = menu1.menuAction[m].read;
                                                }
                                                if (menu1.menuAction[m].write) {
                                                    menuAction.write = menu1.menuAction[m].write;
                                                }
                                                if (menu1.menuAction[m].delete) {
                                                    menuAction.delete = menu1.menuAction[m].delete;
                                                }
                                            } else {
                                                var mAction = {scope: menu1.menuAction[m].scope};
                                                if (menu1.menuAction[m].read) {
                                                    mAction.read = menu1.menuAction[m].read;
                                                }
                                                if (menu1.menuAction[m].write) {
                                                    mAction.write = menu1.menuAction[m].write;
                                                }
                                                if (menu1.menuAction[m].delete) {
                                                    mAction.delete = menu1.menuAction[m].delete;
                                                }
                                                userAccount.user_scopes.push(mAction);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    userAccount.user_scopes = UniqueObjectArray(userAccount.user_scopes,"scope");

                    //set the digin templates to the user.
                    userAccount.app_meta = userAccount.app_meta || {};
                    var userSharedRes = userAccount.app_meta.sharedResources || {};
                    
                    userSharedRes = Object.assign(userSharedRes, vPackage.sharedResources)
                    userAccount.app_meta['sharedResources'] = userSharedRes;

                    UserAccount.findOneAndUpdate({_id: userAccountId}, userAccount, function (err, rUser) {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "Update User Scopes Failed", false, undefined);
                        } else {
                            jsonString = messageFormatter.FormatMessage(err, "Update User Scopes Successful", true, userAccount);
                        }
                        return jsonString;
                    });
                });
            });
        }
    });
}

function CreateOrganisationStanAlone(user, companyname, timezone, callback) {
    logger.debug("DVP-UserService.CreateOrganisationStanAlone Internal method ");

    GetNewCompanyId(function (cid) {
        if (cid && cid > 0) {


            if (user.company === 0) {
                logger.info("DVP-UserService.CreateOrganisationStanAlone Active Tenant: "+ config.Tenant.activeTenant);
                Tenant.findOne({id: config.Tenant.activeTenant}, function (err, Tenants) {
                    if (err) {

                        callback(err, undefined);

                    } else {

                        if (Tenants) {

                            var company =user.username;

                            if(companyname)
                                company = companyname;

                            var org = Org({
                                ownerId: user.username,
                                companyName: company,
                                companyEnabled: true,
                                id: cid,
                                tenant: Tenants.id,
                                packages: [],
                                consoleAccessLimits: [],
                                tenantRef: Tenants._id,
                                ownerRef: user._id,
                                created_at: Date.now(),
                                updated_at: Date.now(),
                                timeZone: timezone
                            });
                            // var usr = {};
                            // usr.company = cid;
                            // usr.Active = true;
                            // usr.updated_at = Date.now();

                            org.save(function (err, org) {
                                if (err) {
                                    callback(err, undefined);
                                } else {

                                    var userAccount = UserAccount({
                                        active: true,
                                        verified: true,
                                        joined: Date.now(),
                                        user: user.username,
                                        userref: user._id,
                                        tenant: org.tenant,
                                        company: org.id,
                                        user_meta: {role: "admin"},
                                        app_meta: {},
                                        user_scopes: [
                                            {scope: "organisation", read: true, write: true},
                                            {scope: "resource", read: true},
                                            {scope: "package", read: true},
                                            {scope: "console", read: true},
                                            {"scope": "myNavigation", "read": true},
                                            {"scope": "myUserProfile", "read": true}
                                        ],
                                        created_at: Date.now(),
                                        updated_at: Date.now(),
                                        multi_login: false
                                    });

                                    userAccount.save(function (err, account) {
                                        if (err) {
                                            org.remove(function (err) {
                                            });
                                            callback(err, undefined);
                                        } else {
                                            //rUser.company = cid;
                                            AssignPackageToOrganisationLib(cid, Tenants.id, "BASIC", user, true, function(jsonString){
                                                console.log(jsonString);
                                            });
                                            callback(undefined, user);
                                        }
                                    });

                                        // User.findOneAndUpdate({username: user.username}, usr, function (err, rUser) {
                                        //     if (err) {
                                        //         org.remove(function (err) {
                                        //         });
                                        //         callback(err, undefined);
                                        //     } else {
                                        //         rUser.company = cid;
                                        //         AssignPackageToOrganisationLib(cid, Tenants.id, "BASIC", rUser,function(jsonString){
                                        //             console.log(jsonString);
                                        //         });
                                        //         callback(undefined, rUser);
                                        //     }
                                        // });
                                }
                            });

                        } else {
                            callback(new Error("No tenants found"), undefined);
                        }
                    }
                });


            }


        } else {
            callback(new Error("ID generation failed"), undefined);
        }
    });
}

function AssignPackageUnitToOrganisation(req,res){

    logger.debug("DVP-UserService.AssignPackageUnitToOrganisation Internal method ");
    logger.debug("Package:: "+req.params.packageName);
    logger.debug("PackageUnit:: "+req.params.unitName);

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);

    var orgId;

    if(req.params.company){
        orgId = parseInt(req.params.company);
    }else{
        orgId = company;
    }


    var topUpCount = 0;
    if(req.params.topUpCount) {
        topUpCount = parseInt(req.params.topUpCount);
    }
    var jsonString;

    if(topUpCount > 0) {
        UserAccount.findOne({tenant: tenant, company: company, user: req.user.iss}).populate('userref' , '-password').exec(function (err, userAccount) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "Error in User Search", false, undefined);
                res.end(jsonString);
            } else {
                if(userAccount) {
                    VPackage.findOne({packageName: req.params.packageName}, function (err, vPackage) {

                        if (err) {

                            jsonString = messageFormatter.FormatMessage(err, "Get Package Failed", false, undefined);
                            res.end(jsonString);

                        } else {
                            if(vPackage) {
                                Org.findOne({tenant: tenant, id: orgId}).populate('ownerRef' , '-password').exec( function (err, org) {

                                    if (err) {

                                        jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
                                        res.end(jsonString);

                                    } else {

                                        if (org) {

                                            if (org.packages.indexOf(req.params.packageName) > -1) {

                                                PackageUnit.findOne({unitName: req.params.unitName}, function (err, packageUnit) {

                                                    if (err) {

                                                        jsonString = messageFormatter.FormatMessage(err, "Get Package Unit Failed", false, undefined);
                                                        res.end(jsonString);

                                                    } else {

                                                        if (packageUnit) {
                                                            if(packageUnit.unitType.toLowerCase() === 'spacelimit'){
                                                                topUpCount = 1;
                                                            }
                                                            var billingObj = {
                                                                userInfo: userAccount.userref,
                                                                companyInfo: org,
                                                                name: packageUnit.unitName,
                                                                type: packageUnit.unitType,
                                                                category: "Veery Unit",
                                                                setupFee: 0,
                                                                unitPrice: packageUnit.unitprice,
                                                                units: topUpCount,
                                                                description: packageUnit.description,
                                                                date: Date.now(),
                                                                valid: true,
                                                                isTrial: false
                                                            };

                                                            RequestToBill(org.id, org.tenant, billingObj, function(err, response){
                                                                if(err){
                                                                    jsonString = messageFormatter.FormatMessage(err, "Error in Billing request", false, undefined);
                                                                    res.end(jsonString);
                                                                }else{
                                                                    if(response) {
                                                                        if(response.IsSuccess) {
                                                                            org.updated_at = Date.now();

                                                                            if(packageUnit.unitType.toLowerCase() === 'spacelimit'){

                                                                                if(packageUnit.unitData && packageUnit.unitData.spaceLimit && packageUnit.unitData.spaceLimit.length >0){
                                                                                    var spaceLimitsToAdd = [];
                                                                                    packageUnit.unitData.spaceLimit.forEach(function (sLimit) {
                                                                                        var existingSpaceLimit = org.spaceLimit.filter(function (esl) {
                                                                                            return esl.spaceType === sLimit.spaceType;
                                                                                        });

                                                                                        if(existingSpaceLimit && existingSpaceLimit.length > 0){
                                                                                            existingSpaceLimit[0].spaceLimit = existingSpaceLimit[0].spaceLimit + sLimit.spaceLimit;
                                                                                            SetCompanySpaceLimit(org.tenant, org.id, sLimit.spaceType, existingSpaceLimit[0]);
                                                                                        }else{
                                                                                            spaceLimitsToAdd.push(sLimit);
                                                                                            SetCompanySpaceLimit(org.tenant, org.id, sLimit.spaceType, sLimit);
                                                                                        }
                                                                                    });

                                                                                    if(spaceLimitsToAdd && spaceLimitsToAdd.length >0) {
                                                                                        org.spaceLimit = org.spaceLimit.concat(spaceLimitsToAdd);
                                                                                    }
                                                                                }

                                                                            }else if(packageUnit.unitType.toLowerCase() === 'codec'){

                                                                                if(packageUnit.unitData && packageUnit.unitData.codecLimit && packageUnit.unitData.codecLimit.length >0){
                                                                                    var codecLimitsToAdd = [];
                                                                                    packageUnit.unitData.codecLimit.forEach(function (cLimit) {
                                                                                        var existingCodecLimit = org.codecAccessLimits.filter(function (esl) {
                                                                                            return esl.codec === cLimit.codec;
                                                                                        });

                                                                                        if(existingCodecLimit && existingCodecLimit.length > 0){
                                                                                            existingCodecLimit[0].codecLimit = existingCodecLimit[0].codecLimit + topUpCount;
                                                                                        }else{
                                                                                            codecLimitsToAdd.push({codec: cLimit.codec, codecLimit: topUpCount, currentAccess: 0});
                                                                                        }
                                                                                    });

                                                                                    if(codecLimitsToAdd && codecLimitsToAdd.length >0) {
                                                                                        org.codecAccessLimits = org.codecAccessLimits.concat(codecLimitsToAdd);
                                                                                    }
                                                                                }

                                                                            }else {
                                                                                if (packageUnit.unitData && packageUnit.unitData.consoleAccessLimit && org.consoleAccessLimits.length > 0) {

                                                                                    for (var j = 0; j < org.consoleAccessLimits.length; j++) {

                                                                                        var cal = org.consoleAccessLimits[j];

                                                                                        if (cal.accessType == packageUnit.unitData.consoleAccessLimit.accessType) {
                                                                                            org.consoleAccessLimits[j].accessLimit = org.consoleAccessLimits[j].accessLimit + topUpCount;
                                                                                            if(packageUnit.unitData && packageUnit.unitData.resources && packageUnit.unitData.resources.length >2) {
                                                                                                if(packageUnit.unitData.resources[2].scopes && packageUnit.unitData.resources[2].scopes.length > 0) {
                                                                                                    packageUnit.unitData.resources[2].scopes[0].limit = topUpCount;
                                                                                                }
                                                                                            }
                                                                                            break;

                                                                                        }
                                                                                    }

                                                                                }
                                                                            }


                                                                            var er = ExtractResources(packageUnit.unitData.resources);
                                                                            er.on('endExtractResources', function (userScopes) {
                                                                                if (userScopes) {
                                                                                    for (var i = 0; i < userScopes.length; i++) {
                                                                                        var scopes = userScopes[i];
                                                                                        var eUserScope = FilterObjFromArray(org.resourceAccessLimits, "scopeName", scopes.scope);
                                                                                        if (eUserScope) {
                                                                                            if (eUserScope.accessLimit != -1 && topUpCount > 0) {
                                                                                                eUserScope.accessLimit = eUserScope.accessLimit + topUpCount;
                                                                                            } else if (topUpCount === -1) {
                                                                                                eUserScope.accessLimit = topUpCount;
                                                                                            }
                                                                                        } else {
                                                                                            if (!org.resourceAccessLimits) {
                                                                                                org.resourceAccessLimits = [];
                                                                                            }
                                                                                            var rLimit = {
                                                                                                "scopeName": scopes.scope,
                                                                                                "accessLimit": scopes.accessLimit
                                                                                            };
                                                                                            org.resourceAccessLimits.push(rLimit);
                                                                                        }
                                                                                    }
                                                                                }

                                                                                org.unitDetails.push({veeryUnit:packageUnit._id, units: topUpCount, buyDate: Date.now()});

                                                                                Org.findOneAndUpdate({
                                                                                    tenant: tenant,
                                                                                    id: orgId
                                                                                }, org, function (err, rOrg) {

                                                                                    if (err) {

                                                                                        jsonString = messageFormatter.FormatMessage(err, "Assign Package Unit to Organisation Failed", false, undefined);

                                                                                    } else {

                                                                                        jsonString = messageFormatter.FormatMessage(err, "Assign Package Unit to Organisation Successful", true, org);

                                                                                    }

                                                                                    res.end(jsonString);
                                                                                });
                                                                            });
                                                                        }else{
                                                                            jsonString = messageFormatter.FormatMessage(undefined, response.CustomMessage, false, undefined);
                                                                            res.end(jsonString);
                                                                        }
                                                                    }else{
                                                                        jsonString = messageFormatter.FormatMessage(err, "Error in Billing request", false, undefined);
                                                                        res.end(jsonString);
                                                                    }
                                                                }
                                                            });

                                                        } else {

                                                            jsonString = messageFormatter.FormatMessage(err, "No Package Unit Found", false, undefined);
                                                            res.end(jsonString);

                                                        }

                                                    }

                                                });
                                            } else {

                                                jsonString = messageFormatter.FormatMessage(err, "No Assigned Package Found", false, undefined);
                                                res.end(jsonString);

                                            }

                                        } else {

                                            jsonString = messageFormatter.FormatMessage(err, "No Organisation Found", false, undefined);
                                            res.end(jsonString);

                                        }

                                    }

                                });
                            }else{
                                jsonString = messageFormatter.FormatMessage(undefined, "No Package Found", false, undefined);
                                res.end(jsonString);
                            }
                        }

                    });

                }else{
                    jsonString = messageFormatter.FormatMessage(undefined, "No User Account Found.", false, undefined);
                    res.end(jsonString);
                }
            }
        });

    }else{

        jsonString = messageFormatter.FormatMessage(undefined, "Top up count should be grater than zero", false, undefined);
        res.end(jsonString);

    }
}

function GetBillingDetails(req, res){
    logger.debug("DVP-UserService.GetPackageUnits Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var billingDetails = [];
    var jsonString;



    Org.findOne({tenant: tenant, id: company}).populate('tenantRef').populate({path: 'packageDetails.veeryPackage',populate : {path: 'Package'}}).populate({path: 'unitDetails.veeryUnit',populate : {path: 'PackageUnit'}}).exec( function(err, org) {


        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Error in Get Organisation", false, billingDetails);
            res.end(jsonString);
        } else {
            if (org) {
                if(org.packageDetails && org.packageDetails.length > 0){
                    for(var i=0; i<org.packageDetails.length;i++){
                        var pInfo = org.packageDetails[i];
                        if(pInfo && pInfo.veeryPackage && pInfo.veeryPackage.billingType === 'recurring') {
                            billingDetails.push({
                                name: pInfo.veeryPackage.packageName,
                                type: pInfo.veeryPackage.packageType,
                                category: "Veery Package",
                                unitPrice: pInfo.veeryPackage.price,
                                units: 1,
                                description: pInfo.veeryPackage.description,
                                date: pInfo.buyDate,
                                valid: true,
                                isTrial: false,
                                details: pInfo.veeryPackage
                            });
                        }
                    }
                }

                if(org.unitDetails && org.unitDetails.length > 0){
                    for(var j=0; j<org.unitDetails.length;j++){
                        var uInfo = org.unitDetails[j];
                        if(uInfo && uInfo.veeryUnit && uInfo.veeryUnit.billingType === 'recurring') {
                            billingDetails.push({
                                name: uInfo.veeryUnit.unitName,
                                type: uInfo.veeryUnit.unitType,
                                category: "Veery Unit",
                                unitPrice: uInfo.veeryUnit.unitprice,
                                units: uInfo.units,
                                description: uInfo.veeryUnit.description,
                                date: uInfo.buyDate,
                                valid: true,
                                isTrial: false,
                                details: uInfo.veeryUnit
                            });
                        }
                    }
                }

                try{
                    dbConn.VoxboneDIDRequest.findAll({where: [{Company: company}, {Tenant: tenant}]})
                        .then(function (didRequest)
                        {

                            if(didRequest)
                            {

                                if(didRequest.length > 0){
                                    for(var k=0; k<didRequest.length;k++){
                                        var nInfo = didRequest[k];
                                        if(nInfo) {
                                            billingDetails.push({
                                                name: nInfo.DidNumber,
                                                type: "PHONE_NUMBER",
                                                category: "DID",
                                                unitPrice: nInfo.DidMonthlyPrice100/100,
                                                units: nInfo.CapacityEnabled,
                                                description: nInfo.DidNumber,
                                                date: nInfo.createdAt,
                                                valid: nInfo.DidEnabled,
                                                isTrial: false,
                                                details: nInfo
                                            });
                                        }
                                    }
                                }


                            }

                            jsonString = messageFormatter.FormatMessage(undefined, "Set Billing Details Success", true, billingDetails);
                            res.end(jsonString);
                        }).catch(function(err)
                        {
                            console.log('[DVP-VoxboneAPI.GetAllDidRequest] - PGSQL query failed', err);
                            jsonString = messageFormatter.FormatMessage(undefined, "Set Billing Details Failed, Retrieving number details unsuccessful", false, billingDetails);
                            res.end(jsonString);
                        });
                }catch(ex){
                    console.log('[DVP-VoxboneAPI.GetAllDidRequest] - PGSQL query failed', err);
                    jsonString = messageFormatter.FormatMessage(undefined, "Set Billing Details Failed, Retrieving number details unsuccessful", false, billingDetails);
                    res.end(jsonString);
                }


            }else {
                jsonString = messageFormatter.FormatMessage(undefined, "Find Organisation Failed", false, billingDetails);
                res.end(jsonString);
            }
        }
    });




    //var billingObj = [
    //    {name: "CONTACT CENTER SILVER",type: "CALLCENTER",category: "veeryPackage",unitPrice: 100,units: 1, description: "",date: "2016-01-20",valid: true, isTrial: false},
    //    {name: "AGENT",type: "CALLCENTER",category: "veeryUnit",unitPrice: 10,units: 1, description: "",date: "2016-01-20",valid: true, isTrial: false},
    //    {name: "112456325",type: "CALLCENTER",category: "DID",unitPrice: 1,units: 1, description: "",date: "2016-01-20",valid: true, isTrial: false}
    //];
    //
    //jsonString = messageFormatter.FormatMessage(undefined, "Set Billing Details Success", true, billingObj);
    //res.end(jsonString);
}

function RequestToBill(company, tenant, billInfo, callback){
    try {
        var contextUrl = util.format("http://%s/DVP/API/%s/Billing/BuyPackage", config.Services.billingserviceHost, config.Services.billingserviceVersion);
        if (validator.isIP(config.Services.billingserviceHost)) {
            contextUrl = util.format("http://%s:%s/DVP/API/%s/Billing/BuyPackage", config.Services.billingserviceHost, config.Services.billingservicePort, config.Services.billingserviceVersion);
        }
        var companyInfo = util.format("%d:%d", tenant, company);
        restClientHandler.DoPost(companyInfo, contextUrl, billInfo, function (err, res1, result) {
            if(err){
                callback(err, undefined);
            }else{
                if(res1.statusCode === 200) {
                    callback(undefined, JSON.parse(result));
                }else{
                    callback(new Error(result), undefined);
                }
            }
        });
    }catch(ex){
        callback(ex, undefined);
    }
}

function GetSpaceLimit(req, res){
    logger.debug("DVP-UserService.GetSpaceLimit Internal method ");

    var tenant = parseInt(req.user.tenant);
    var company;
    if(req.params.company){
        company = parseInt(req.params.company);
    }else {
        company = parseInt(req.user.company);
    }
    var jsonString;
    Org.findOne({tenant: tenant, id: company}).exec( function(err, org) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
        }else{
            if(org){

                var spaceLimits = [];
                var filteredSpaceValues = org.spaceLimit.filter(function (sLimit) {
                    return sLimit.spaceType.toLowerCase().indexOf(req.params.spaceType.toLowerCase()) > -1;
                });

                if(filteredSpaceValues){
                    filteredSpaceValues.forEach(function (filterValue) {
                        var tempObj = {CompanyId: org.id, SpaceLimit: undefined};
                        var tempSpaceLimitInfo = {};

                        tempSpaceLimitInfo.SpaceType = filterValue.spaceType;
                        tempSpaceLimitInfo.SpaceUnit = filterValue.spaceUnit;
                        tempSpaceLimitInfo.SpaceLimit = filterValue.spaceLimit;

                        tempObj.SpaceLimit = tempSpaceLimitInfo;

                        if(tempObj && tempObj.SpaceLimit) {
                            spaceLimits.push(tempObj);
                        }
                    });



                    jsonString = messageFormatter.FormatMessage(err, "Get Space Limit Successful", true, spaceLimits);

                    //if(filteredSpaceValues.length > 1){
                    //
                    //    spaceLimitInfo.SpaceType = filteredSpaceValues[0].spaceType;
                    //    spaceLimitInfo.SpaceUnit = filteredSpaceValues[0].spaceUnit;
                    //    filteredSpaceValues.forEach(function (limit) {
                    //        spaceLimitInfo.SpaceLimit = spaceLimitInfo.SpaceLimit + limit.spaceLimit;
                    //    });
                    //    jsonString = messageFormatter.FormatMessage(err, "Get Space Limit Successful", true, spaceLimitInfo);
                    //}else{
                    //    if(filteredSpaceValues.length === 1) {
                    //        spaceLimitInfo.SpaceType = filteredSpaceValues[0].spaceType;
                    //        spaceLimitInfo.SpaceUnit = filteredSpaceValues[0].spaceUnit;
                    //        spaceLimitInfo.SpaceLimit = filteredSpaceValues[0].spaceLimit;
                    //        jsonString = messageFormatter.FormatMessage(err, "Get Space Limit Successful", true, spaceLimitInfo);
                    //    }else{
                    //        jsonString = messageFormatter.FormatMessage(undefined, "No Space Limit Found", false, undefined);
                    //    }
                    //}

                }else{
                    jsonString = messageFormatter.FormatMessage(undefined, "No Space Limit Found", false, undefined);
                }

            }else{
                jsonString = messageFormatter.FormatMessage(undefined, "No Organisation Found", false, undefined);
            }

        }
        res.end(jsonString);
    });
}

function GetSpaceLimitForTenant(req, res){
    logger.debug("DVP-UserService.GetSpaceLimit Internal method ");

    var tenant = parseInt(req.user.tenant);
    var jsonString;
    Org.find({tenant: tenant}).exec( function(err, orgs) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Find Organisation Failed", false, undefined);
        }else{
            if(orgs){

                var spaceLimits = [];

                orgs.forEach(function (org) {

                    var filteredSpaceValues = org.spaceLimit.filter(function (sLimit) {
                        return sLimit && sLimit.spaceType.toLowerCase().indexOf(req.params.spaceType.toLowerCase()) > -1;
                    });

                    if(filteredSpaceValues){

                        filteredSpaceValues.forEach(function (filterValue) {
                            var tempObj = {CompanyId: org.id, SpaceLimit: undefined};
                            var tempSpaceLimitInfo = {};
                            //if(filteredSpaceValues.length > 1){
                            //
                            //    tempSpaceLimitInfo.SpaceType = filterValue.spaceType;
                            //    tempSpaceLimitInfo.SpaceUnit = filterValue.spaceUnit;
                            //    filteredSpaceValues.forEach(function (limit) {
                            //        tempSpaceLimitInfo.SpaceLimit = tempSpaceLimitInfo.SpaceLimit + limit.spaceLimit;
                            //    });
                            //    tempObj.SpaceLimit = tempSpaceLimitInfo;
                            //}else{
                            //
                            //    if(filteredSpaceValues.length === 1) {
                                    tempSpaceLimitInfo.SpaceType = filterValue.spaceType;
                                    tempSpaceLimitInfo.SpaceUnit = filterValue.spaceUnit;
                                    tempSpaceLimitInfo.SpaceLimit = filterValue.spaceLimit;

                                    tempObj.SpaceLimit = tempSpaceLimitInfo;
                            //    }
                            //}

                            if(tempObj && tempObj.SpaceLimit) {
                                spaceLimits.push(tempObj);
                            }
                        });

                    }
                });

                jsonString = messageFormatter.FormatMessage(undefined, "Get Space Limit Successful", true, spaceLimits);

            }else{
                jsonString = messageFormatter.FormatMessage(undefined, "No Organisation Found", false, undefined);
            }

        }
        res.end(jsonString);
    });
}

module.exports.GetOrganisation = GetOrganisation;
module.exports.GetOrganisations = GetOrganisations;
module.exports.DeleteOrganisation = DeleteOrganisation;
//module.exports.CreateOrganisation = CreateOrganisation;
module.exports.UpdateOrganisation = UpdateOrganisation;
module.exports.AssignPackageToOrganisation = AssignPackageToOrganisation;
module.exports.RemovePackageFromOrganisation = RemovePackageFromOrganisation;
//module.exports.CreateOwner = CreateOwner;
module.exports.GetOrganisationPackages = GetOrganisationPackages;
module.exports.GetOrganisationPackagesWithDetails = GetOrganisationPackagesWithDetails;
module.exports.GetOrganisationName = GetOrganisationName;
module.exports.AssignPackageUnitToOrganisation = AssignPackageUnitToOrganisation;
module.exports.CreateOrganisationStanAlone = CreateOrganisationStanAlone;
module.exports.ActivateOrganisation = ActivateOrganisation;
module.exports.GetOrganisationsWithPaging = GetOrganisationsWithPaging;
module.exports.GetBillingDetails = GetBillingDetails;
module.exports.IsOrganizationExists = IsOrganizationExists;
module.exports.GetSpaceLimit = GetSpaceLimit;
module.exports.GetSpaceLimitForTenant = GetSpaceLimitForTenant;
