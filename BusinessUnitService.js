/**
 * Created by Pawan on 12/29/2017.
 */

var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var BusinessUnit = require('dvp-mongomodels/model/BusinessUnit').BusinessUnit;
var UserAccount = require('dvp-mongomodels/model/UserAccount');
var unique = require('array-unique');
var util = require('util');
var UserGroup = require('dvp-mongomodels/model/UserGroup').UserGroup;


function AddBusinessUnit(req, res) {

    try {
        logger.debug("DVP-BusinessUnitService.AddBusinessUnit Internal method ");
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var username = req.user.iss;
        var jsonString;

        if (req.body && req.body.unitName) {
            if (req.body.unitName.toLowerCase() != "default" || req.body.unitName.toLowerCase() != "all") {
                if (username) {
                    //company:company,tenant:tenant,
                    UserAccount.findOne({
                        company: company,
                        tenant: tenant,
                        user: username,
                        $or: [{'user_meta.role': 'admin'}, {'user_meta.role': 'supervisor'}]
                    }).populate('userref', '-password').exec(function (errUser, resUser) {

                        if (errUser || !resUser) {
                            jsonString = messageFormatter.FormatMessage(errUser, "Error in searching user", false, undefined);
                        }
                        else {
                            var unitObj =
                                {
                                    owner: resUser.userref,
                                    unitName: req.body.unitName,
                                    description: req.body.description,
                                    created_at: Date.now(),
                                    company: company,
                                    tenant: tenant
                                };

                            if (req.body.headUsers && util.isArray(req.body.headUsers)) {
                                unitObj.heads = req.body.headUsers;
                            }

                            var BzUnit = BusinessUnit(unitObj);

                            BzUnit.save(function (errUnit, resUnit) {

                                if (errUnit) {
                                    jsonString = messageFormatter.FormatMessage(errUnit, "Error in saving new Business Unit ", false, undefined);
                                }
                                else {
                                    if (resUnit) {
                                        jsonString = messageFormatter.FormatMessage(undefined, "Business Unit Successfully Saved ", true, resUnit);
                                    }
                                    else {
                                        jsonString = messageFormatter.FormatMessage(undefined, "Business Unit saving failed ", false, resUnit);
                                    }

                                }

                                res.end(jsonString);
                            });

                        }
                    });
                }
                else {
                    jsonString = messageFormatter.FormatMessage(new Error("No authorized user for the request"), "No authorized user for the request", false, undefined);
                    res.end(jsonString);
                }
            }
            else {
                jsonString = messageFormatter.FormatMessage(new Error("Cannot use " + req.body.unitName + " as a Business Unit Name"), "Cannot use " + req.body.unitName + " as a Business Unit Name", false, undefined);
                res.end(jsonString);
            }

        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("Insufficient data found to create a business unit"), "Insufficient data found to create a business unit", false, undefined);
            res.end(jsonString);
        }


    }
    catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : AddBusinessUnit ", false, undefined);
        res.end(jsonString);
    }


};

function AddDefaultBusinessUnit(companyId, tenantId, ownerRef) {

    try {
        logger.debug("DVP-BusinessUnitService.AddDefaultBusinessUnit Internal method ");

        var unitObj =
            {
                unitName: 'ALL',
                description: 'ALL',
                created_at: Date.now(),
                company: companyId,
                tenant: tenantId
            };

        //var ObjectId = mongoose.Types.ObjectId;

        var arr = [];

        arr.push(ownerRef);

        unitObj.heads = arr;

        var BzUnit = BusinessUnit(unitObj);

        BzUnit.save(function (errUnit, resUnit) {

            if (errUnit) {
                logger.error(messageFormatter.FormatMessage(errUnit, "Error in saving new Business Unit ", false, null));
            }
            else {
                logger.info(messageFormatter.FormatMessage(null, "Default business unit added", true, null));
            }
        });


    }
    catch (e) {
        logger.error(messageFormatter.FormatMessage(e, "Error in saving new Business Unit ", false, null), e);
    }

};

function UpdateBusinessUnit(req, res) {

    try {
        logger.debug("DVP-BusinessUnitService.UpdateBusinessUnit Internal method ");
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        if (req.body && req.params.unitname) {
            var updateObj = {
                description: req.body.description
            }
            if (req.body.heads && util.isArray(req.body.heads)) {
                updateObj.heads = req.body.heads;


            }

            BusinessUnit.findOneAndUpdate({
                company: company,
                tenant: tenant,
                unitName: req.params.unitname
            }, updateObj, function (errUpdate, resUpdate) {

                if (errUpdate) {
                    jsonString = messageFormatter.FormatMessage(errUpdate, "Error in updating Business Unit ", false, undefined);
                }
                else {
                    jsonString = messageFormatter.FormatMessage(undefined, "Updating Business Unit succeeded ", true, resUpdate);
                }
                res.end(jsonString);
            });


        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("Insufficient data found to update a business unit"), "Insufficient data found to create a business unit", false, undefined);
            res.end(jsonString);
        }


    }
    catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : UpdateBusinessUnit ", false, undefined);
        res.end(jsonString);
    }


};

function UpdateBusinessUnitUserGroups(req, res) {

    try {
        logger.debug("DVP-BusinessUnitService.UpdateBusinessUnitUserGroups Internal method ");
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        if (req.body && req.params.unitname && req.body.groups) {

            var groupObj =
                {
                    $or: [],
                    company: company,
                    tenant: tenant
                }

            req.body.groups.forEach(function (item) {

                groupObj.$or.push({_id: item});

            });


            BusinessUnit.findOne({
                company: company,
                tenant: tenant,
                unitName: req.params.unitname
            }, function (errUpdate, resUpdate) {

                if (errUpdate) {
                    jsonString = messageFormatter.FormatMessage(errUpdate, "Error in Searching Business Unit ", false, undefined);
                    res.end(jsonString);
                }
                else {
                    UserGroup.findOneAndUpdate(groupObj, {businessUnit: req.params.unitname}, function (errGroupUpdate, resGroupUpdate) {

                        if (errGroupUpdate) {
                            jsonString = messageFormatter.FormatMessage(errGroupUpdate, "Error in updating Business Unit of Groups ", false, undefined);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Updating Business Unit of Groups succeeded ", true, resUpdate);
                        }
                        res.end(jsonString);
                    });

                }

            });


        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("Insufficient data found to update a business unit User groups"), "Insufficient data found to create a business unit", false, undefined);
            res.end(jsonString);
        }


    }
    catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : UpdateBusinessUnitUserGroups ", false, undefined);
        res.end(jsonString);
    }


};


function GetBusinessUnits(req,res) {

    try {
        logger.debug("DVP-BusinessUnitService.GetBusinessUnit Internal method ");
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;
        var query = {tenant:tenant};

        if(req.params.consolidated !== 'consolidated'){
            query["company"] = company;
        }

        BusinessUnit.find(query).populate('heads').exec(function (errUnits,resUnits) {
            if(errUnits)
            {
                jsonString = messageFormatter.FormatMessage(errUnits, "Error in searching BusinessUnits ", false, undefined);
            }
            else {
                jsonString = messageFormatter.FormatMessage(undefined, "BusinessUnits Found ", true, resUnits);
            }
            res.end(jsonString);
        });


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : GetBusinessUnit ", false, undefined);
        res.end(jsonString);
    }


};


function GetBusinessUnitsWithGroups(req, res) {

    try {
        logger.debug("DVP-BusinessUnitService.GetBusinessUnitsWithGroups Internal method ");
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;


        BusinessUnit.find({company: company, tenant: tenant}).populate('heads').exec(function (errUnits, resUnits) {
            if (errUnits) {
                jsonString = messageFormatter.FormatMessage(errUnits, "Error in searching BusinessUnits ", false, undefined);
                res.end(jsonString);
            }
            else {
                var qObj = {
                    company: company,
                    tenant: tenant,
                    $or: []
                }

                if (resUnits) {
                    resUnits.forEach(function (item) {
                        qObj.$or.push({businessUnit: item.unitName});
                    });
                }

                UserGroup.find(qObj).exec(function (errGroups, resGroups) {

                    if (errGroups) {
                        jsonString = messageFormatter.FormatMessage(errGroups, "Error in searching User Groups ", false, undefined);
                        res.end(jsonString);
                    }
                    else {
                        resUnits.forEach(function (unit) {

                            resGroups.forEach(function (group) {

                                if (group.businessUnit == unit.unitName) {
                                    if (unit._doc && !unit._doc.groups) {
                                        unit._doc.groups = [];
                                    }
                                    unit._doc.groups.push(group);
                                }

                            });

                        });

                        jsonString = messageFormatter.FormatMessage(undefined, "BusinessUnits with Groups Found ", true, resUnits);
                        res.end(jsonString);
                    }


                });


            }

        });


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : GetBusinessUnit ", false, undefined);
        res.end(jsonString);
    }


};


function GetBusinessUnit(req, res) {

    try {
        logger.debug("DVP-BusinessUnitService.GetBusinessUnit Internal method ");
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;


        if (req.params.unitName) {
            BusinessUnit.find({
                company: company,
                tenant: tenant,
                unitName: req.params.unitName
            }, function (errUnit, resUnit) {
                if (errUnit) {
                    jsonString = messageFormatter.FormatMessage(errUnit, "Error in searching BusinessUnit ", false, undefined);
                }
                else {
                    jsonString = messageFormatter.FormatMessage(undefined, "BusinessUnit Found : " + req.params.unitName, true, resUnit);
                }
                res.end(jsonString);
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No UnitName received"), "No UnitName received ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation : GetBusinessUnit ", false, undefined);
        res.end(jsonString);
    }


};

function GetSupervisorBusinessUnits(req, res) {


    logger.debug("DVP-UserService.GetSupervisorBusinessUnits Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        if (req.params.sid) {
            BusinessUnit.find({
                company: company,
                tenant: tenant,
                heads: {$in: [req.params.sid]}
            }).exec(function (errUsers, resUsers) {

                if (errUsers) {
                    logger.error("DVP-UserService.GetSupervisorBusinessUnits :  Error in searching supervisors ", errUsers);
                    jsonString = messageFormatter.FormatMessage(errUsers, "Error in searching Business Units", false, undefined);
                }
                else {
                    if (resUsers) {

                        jsonString = messageFormatter.FormatMessage(undefined, "Business Units found", true, unique(resUsers));
                        logger.debug("DVP-UserService.GetSupervisorBusinessUnits :  Business Units found ");
                    }
                    else {
                        jsonString = messageFormatter.FormatMessage(undefined, "Business Units Failed", false, undefined);
                        logger.error("DVP-UserService.GetSupervisorBusinessUnits :  Business Units Failed ");
                    }
                }

                res.end(jsonString);
            });
        }
        else {
            logger.error("DVP-UserService.GetSupervisorBusinessUnits :  No supervisor ID found ");
            jsonString = messageFormatter.FormatMessage(new Error("No supervisor ID found"), "No supervisor ID found", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in searching Business Units", false, undefined);
        res.end(jsonString);
    }


}

function AddHeadToBusinessUnits(req, res) {


    logger.debug("DVP-UserService.AddHeadToBusinessUnits Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        if (req.params && req.params.hid && req.params.name) {
            UserAccount.findOne({
                userref: req.params.hid,
                company: company,
                tenant: tenant
            }).exec(function (errUser, resUser) {

                if (errUser) {
                    logger.error("DVP-UserService.AddHeadToBusinessUnits :  Error in searching User data ", errUser);
                    jsonString = messageFormatter.FormatMessage(errUser, "Error in searching User data", false, undefined);
                    res.end(jsonString);
                }
                else {

                    if (resUser.user_meta && (resUser.user_meta.role == "admin" || resUser.user_meta.role == "supervisor")) {
                        BusinessUnit.findOneAndUpdate({
                            unitName: req.params.name,
                            company: company,
                            tenant: tenant
                        }, {$push: {heads: resUser.userref}}).exec(function (errAttach, resAttach) {
                            if (errAttach) {
                                logger.error("DVP-UserService.AddHeadToBusinessUnits :  Error in Attaching Head to Business Unit ", errAttach);
                                jsonString = messageFormatter.FormatMessage(errAttach, "Error in Attaching Head to Business Unit", false, undefined);
                            }
                            else {
                                jsonString = messageFormatter.FormatMessage(undefined, "Head attached to Business Units successfully", true, resAttach);
                                logger.debug("DVP-UserService.AddHeadToBusinessUnits :  Head attached to Business Units successfully ");
                            }
                            res.end(jsonString);
                        });


                    }
                    else {
                        logger.error("DVP-UserService.AddHeadToBusinessUnits :  User does not have supervisor or admin privilege to be a Head ");
                        jsonString = messageFormatter.FormatMessage(new Error("User does not have supervisor or admin privilege to be a Head"), "Error in searching User data", false, undefined);
                        res.end(jsonString);
                    }
                }

            });


        }
        else {
            logger.error("DVP-UserService.AddHeadToBusinessUnits :  No supervisor ID or BusinessUnit name found ");
            jsonString = messageFormatter.FormatMessage(new Error("No supervisor ID or BusinessUnit name found "), "No supervisor ID or BusinessUnit name found ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in attaching Head to Business Unit", false, undefined);
        res.end(jsonString);
    }


}

function RemoveHeadToBusinessUnits(req, res) {


    logger.debug("DVP-UserService.RemoveHeadToBusinessUnits Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;


        if (req.params && req.params.hid && req.params.name) {
            BusinessUnit.findOneAndUpdate({
                unitName: req.params.name,
                company: company,
                tenant: tenant
            }, {$pull: {heads: req.params.hid}}).exec(function (errAttach, resAttach) {
                if (errAttach) {
                    logger.error("DVP-UserService.RemoveHeadToBusinessUnits :  Error in Detaching Head to Business Unit ", errAttach);
                    jsonString = messageFormatter.FormatMessage(errAttach, "Error in Detaching Head to Business Unit", false, undefined);
                }
                else {
                    jsonString = messageFormatter.FormatMessage(undefined, "Head attached to Business Units successfully", true, resAttach);
                    logger.debug("DVP-UserService.AddHeadToBusinessUnits :  Head attached to Business Units successfully ");
                }
                res.end(jsonString);
            });


        }
        else {
            logger.error("DVP-UserService.RemoveHeadToBusinessUnits :  No supervisor ID or BusinessUnit name found ");
            jsonString = messageFormatter.FormatMessage(new Error("No supervisor ID or BusinessUnit name found "), "No supervisor ID or BusinessUnit name found ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in Detaching Head to Business Unit", false, undefined);
        res.end(jsonString);
    }


}

function AddHeadsToBusinessUnit(req, res) {


    logger.debug("DVP-UserService.AddHeadsToBusinessUnit Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;
        var headUsers = [];

        if (req.body && req.body.headUsers) {
            headUsers = req.body.headUsers;
        }


        if (req.params && req.params.name && headUsers.length > 0) {
            var quearyObj =

                {
                    company: company,
                    tenant: tenant,
                    $or: [{'user_meta.role': 'admin'}, {'user_meta.role': 'supervisor'}],
                    _id: {$in: headUsers},
                    active: true
                }


            UserAccount.find(quearyObj).populate('userref', '-password').exec(function (errUser, resUser) {

                if (errUser) {
                    logger.error("DVP-UserService.AddHeadsToBusinessUnit :  Error in searching User data ", errUser);
                    jsonString = messageFormatter.FormatMessage(errUser, "Error in searching User data", false, undefined);
                    res.end(jsonString);
                }
                else {

                    var users = resUser.map(function (item) {

                        return item.userref;
                    });

                    BusinessUnit.findOneAndUpdate({
                        unitName: req.params.name,
                        company: company,
                        tenant: tenant
                    }, {$push: {heads: users}}).exec(function (errAttach, resAttach) {
                        if (errAttach) {
                            logger.error("DVP-UserService.AddHeadsToBusinessUnit :  Error in Attaching Head to Business Unit ", errAttach);
                            jsonString = messageFormatter.FormatMessage(errAttach, "Error in Attaching Head to Business Unit", false, undefined);
                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Head attached to Business Units successfully", true, resAttach);
                            logger.debug("DVP-UserService.AddHeadsToBusinessUnit :  Head attached to Business Units successfully ");
                        }
                        res.end(jsonString);
                    });


                }

            });


        }
        else {
            logger.error("DVP-UserService.AddHeadsToBusinessUnit :  No supervisor ID or BusinessUnit name found ");
            jsonString = messageFormatter.FormatMessage(new Error("No supervisor ID or BusinessUnit name found "), "No supervisor ID or BusinessUnit name found ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in attaching Head to Business Unit", false, undefined);
        res.end(jsonString);
    }


}

function GetMyBusinessUnit(req, res) {


    logger.debug("DVP-UserService.GetMyBusinessUnit Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        UserAccount.findOne({
            company: company,
            tenant: tenant,
            user: req.user.iss
        }).populate('group').exec(function (errUser, resUser) {

            if (errUser) {
                jsonString = messageFormatter.FormatMessage(errUser, "User searching Failed", false, undefined);
                logger.error("DVP-UserService.GetMyBusinessUnit :  User searching Failed ");
                res.end(jsonString);
            }
            else {
                if (resUser && resUser.group && resUser.group.businessUnit) {
                    jsonString = messageFormatter.FormatMessage(undefined, "User details found", true, resUser.group.businessUnit);
                    logger.debug("DVP-UserService.GetMyBusinessUnit :  User details found ");
                    res.end(jsonString);
                }
                else {
                    jsonString = messageFormatter.FormatMessage(undefined, "User details found / No business Unit found", true, undefined);
                    logger.debug("DVP-UserService.GetMyBusinessUnit :  User details found / No business Unit found ");
                    res.end(jsonString);
                }
            }
        });


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation GetMyBusinessUnit", false, undefined);
        res.end(jsonString);
    }


};

function GetUsersOfBusinessUnits(req, res){


    logger.debug("DVP-UserService.GetMyBusinessUnit Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;
        var queryString;
        var page = 0;
        var size = 0;
        var skip = 0;
        var isPaging = false;

        var returnFunc = function (errUsers,resUsers) {
            if(errUsers)
            {
                jsonString = messageFormatter.FormatMessage(errUsers, "User searching Failed", false, undefined);
                logger.error("DVP-UserService.GetUsersOfBusinessUnits :  User searching Failed ");
                res.end(jsonString);
            }
            else
            {

                var users = resUsers.reduce(function(arr,item,index,items){

                    if(item && item.userref) {
                        item.userref.resourceid = item.resource_id;
                        arr.push(item.userref);
                    }else{

                        logger.error("UserAccount found without account reference");
                    }
                    return arr;

                },[]);
                // var users = resUsers.map(function(item){
                //
                //     item.userref.resourceid = item.resource_id;
                //     return item.userref;
                // });
                jsonString = messageFormatter.FormatMessage(undefined, "User searching Succeeded", true, users);
                logger.debug("DVP-UserService.GetUsersOfBusinessUnits :  User searching Succeeded ");
                res.end(jsonString);
            }
        }
        var execFunc = function (isPaging,groupIds) {


            queryString = {company: company, tenant: tenant, active:true};
            if(groupIds && groupIds.length>0)
            {
                queryString.group={$in:groupIds};
            }

            if(isPaging)
            {
                UserAccount.find(queryString).select({"password":0, "user_meta": 0, "app_meta":0, "user_scopes":0, "client_scopes":0}).populate('userref', '-password').lean().skip(skip)
                    .limit(size).exec(returnFunc);
            }
            else
            {
                UserAccount.find(queryString).select({"password":0, "user_meta": 0, "app_meta":0, "user_scopes":0, "client_scopes":0}).populate('userref', '-password').lean().exec(returnFunc);
            }

        };

        if (req.query.Page && req.query.Size) {
            page = parseInt(req.query.Page),
                size = parseInt(req.query.Size),
                skip = page > 0 ? ((page - 1) * size) : 0;
            isPaging = true;
        }


        if(req.params.name)
        {

            if(req.params.name.toLowerCase() =="all")
            {
                execFunc(isPaging,[]);

            }
            else
            {
                UserGroup.find({
                    company: company,
                    tenant: tenant,
                    businessUnit:req.params.name}).exec(function (errGroups, resGroups) {

                    if (errGroups) {
                        logger.error("DVP-UserService.GetUsersOfBusinessUnits :  Error in searching supervisors ",errGroups);
                        jsonString = messageFormatter.FormatMessage(errGroups, "Error in searching Business Units", false, undefined);
                        res.end(jsonString);
                    }
                    else {
                        if (resGroups) {

                            var grouiIds=[];
                            resGroups.forEach(function (item) {

                                grouiIds.push(item._id);

                            });

                            execFunc(isPaging,grouiIds);

                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "Business Units searching Failed", false, undefined);
                            logger.error("DVP-UserService.GetUsersOfBusinessUnits :  Business Units searching Failed ");
                            res.end(jsonString);
                        }
                    }


                });
            }


        }
        else
        {
            logger.error("DVP-UserService.GetUsersOfBusinessUnits :  No Business Unit name received ");
            jsonString = messageFormatter.FormatMessage(new Error(" No Business Unit name received "), " No Business Unit name received ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in searching Business Units", false, undefined);
        res.end(jsonString);
    }


};

module.exports.GetBusinessUnitAndGroupsByResourceId = function (req, res) {

    logger.debug("GetBusinessUnitAndGroupsByResourceId Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        //select({"password":0, "user_meta": 0, "app_meta":0, "user_scopes":0, "client_scopes":0}).populate('group', 'businessUnit').exec(function (errUsers,resUsers) {
        if (req.params.ResourceId) {
            UserAccount.findOne(
                {
                    company: company,
                    tenant: tenant,
                    active: true,
                    resource_id: req.params.ResourceId.toString()
                }
            ).populate({
                path: 'group'
            }).exec(function (errUsers, resUsers) {

                if (errUsers) {
                    jsonString = messageFormatter.FormatMessage(errUsers, "GetBusinessUnitAndGroupsByResourceId searching Failed", false, undefined);
                    logger.error("GetBusinessUnitAndGroupsByResourceId :  User searching Failed ");
                    res.end(jsonString);
                }
                else {
                    var businessUnitNames = [];
                    var result = {groups: [], businessUnits: []};
                    if (resUsers && resUsers.group) {
                        /*businessUnitNames = resUsers.group.reduce(function(arr,item,index,items){
                            arr.push(item.group.businessUnit);
                            result["groups"].push(resUsers.group.id);
                            return arr;
                        },[]);*/

                        businessUnitNames.push(resUsers.group.businessUnit);
                        result["groups"].push(resUsers.group.id);
                    }



                    BusinessUnit.find({ unitName: { $in: businessUnitNames },
                        company: company,
                        tenant: tenant }).exec(function (errUser, resbusinessUnit) {

                        if (errUser) {
                            logger.error("GetBusinessUnitAndGroupsByResourceId  Error in searching User data ", errUser);
                            jsonString = messageFormatter.FormatMessage(errUser, "GetBusinessUnitAndGroupsByResourceId Error in searching User data", false, undefined);
                            res.end(jsonString);
                        }
                        else {
                            resbusinessUnit.map(function (item) {
                                result["businessUnits"].push(item.id);
                            });

                            jsonString = messageFormatter.FormatMessage(undefined, "User searching Succeeded", true, result);
                            logger.debug("DVP-UserService.GetUsersOfBusinessUnits :  User searching Succeeded ");
                            res.end(jsonString);
                        }

                    });


                }
            });
        }
        else {
            logger.error("DVP-UserService.GetUsersOfBusinessUnits :  No ResourceId received ");
            jsonString = messageFormatter.FormatMessage(new Error(" No ResourceId received "), " No ResourceId received ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in searching Business Units", false, undefined);
        res.end(jsonString);
    }
};

function GetUserCountOfBusinessUnit (req,res)
{
    logger.debug("DVP-UserService.GetUserCountOfBusinessUnit Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        if(req.params.name)
        {

            if(req.params.name.toLowerCase() =="all")
            {
                UserAccount.count(
                    {
                        company: company,
                        tenant: tenant,
                        active:true
                    }
                ).exec(function (errUsers,cntUsers) {

                    if(errUsers)
                    {
                        jsonString = messageFormatter.FormatMessage(errUsers, "User count searching Failed", false, undefined);
                        logger.error("DVP-UserService.GetUserCountOfBusinessUnit :  User count searching Failed ");
                        res.end(jsonString);
                    }
                    else
                    {

                        jsonString = messageFormatter.FormatMessage(undefined, "User count searching Succeeded", true, cntUsers);
                        logger.debug("DVP-UserService.GetUserCountOfBusinessUnit :  User count searching Succeeded ");
                        res.end(jsonString);
                    }
                });
            }
            else
            {
                UserGroup.find({
                    company: company,
                    tenant: tenant,
                    businessUnit:req.params.name}).exec(function (errGroups, resGroups) {

                    if (errGroups) {
                        logger.error("DVP-UserService.GetUserCountOfBusinessUnit :  Error in searching user groups ",errGroups);
                        jsonString = messageFormatter.FormatMessage(errGroups, "Error in searching user groups", false, undefined);
                        res.end(jsonString);
                    }
                    else {
                        if (resGroups) {

                            var grouiIds=[];

                            resGroups.forEach(function (item) {

                                grouiIds.push(item._id);

                            });

                            UserAccount.count({
                                company: company,
                                tenant: tenant,
                                active:true,
                                group:{$in:grouiIds}}).exec(function (errUsers,cntUsers) {

                                if(errUsers)
                                {
                                    jsonString = messageFormatter.FormatMessage(errUsers, "User count searching Failed", false, undefined);
                                    logger.error("DVP-UserService.GetUserCountOfBusinessUnit :  User count searching Failed ");
                                    res.end(jsonString);
                                }
                                else
                                {

                                    jsonString = messageFormatter.FormatMessage(undefined, "User count searching Succeeded", true, cntUsers);
                                    logger.debug("DVP-UserService.GetUserCountOfBusinessUnit :  User count searching Succeeded ");
                                    res.end(jsonString);
                                }
                            });

                        }
                        else {
                            jsonString = messageFormatter.FormatMessage(undefined, "No user group found", false, undefined);
                            logger.error("DVP-UserService.GetUserCountOfBusinessUnit :  No user group found ");
                            res.end(jsonString);
                        }
                    }


                });
            }


            /*User.find({
             company: company,
             tenant: tenant
             }).populate({
             path:'group',
             match:{businessUnit:{$eq:req.params.name}}
             }).exec(function (errUsers, resUsers) {

             if (errUsers) {
             logger.error("DVP-UserService.GetUsersOfBusinessUnits :  Error in searching supervisors ",errUsers);
             jsonString = messageFormatter.FormatMessage(errUsers, "Error in searching Business Units", false, undefined);
             }
             else {
             if (resUsers) {

             jsonString = messageFormatter.FormatMessage(undefined, "Business Units found", true, unique(resUsers));
             logger.debug("DVP-UserService.GetUsersOfBusinessUnits :  Business Units found ");
             }
             else {
             jsonString = messageFormatter.FormatMessage(undefined, "Business Units Failed", false, undefined);
             logger.error("DVP-UserService.GetUsersOfBusinessUnits :  Business Units Failed ");
             }
             }

             res.end(jsonString);
             });*/
        }
        else
        {
            logger.error("DVP-UserService.GetUserCountOfBusinessUnit :  No Business Unit name received ");
            jsonString = messageFormatter.FormatMessage(new Error(" No Business Unit name received "), " No Business Unit name received ", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in searching Business Units", false, undefined);
        res.end(jsonString);
    }
}


module.exports.AddBusinessUnit = AddBusinessUnit;
module.exports.GetBusinessUnits = GetBusinessUnits;
module.exports.GetBusinessUnit = GetBusinessUnit;
module.exports.GetSupervisorBusinessUnits = GetSupervisorBusinessUnits;
module.exports.AddHeadToBusinessUnits = AddHeadToBusinessUnits;
module.exports.AddHeadsToBusinessUnit = AddHeadsToBusinessUnit;
module.exports.UpdateBusinessUnit = UpdateBusinessUnit;
module.exports.GetUsersOfBusinessUnits = GetUsersOfBusinessUnits;
module.exports.GetBusinessUnitsWithGroups = GetBusinessUnitsWithGroups;
module.exports.GetMyBusinessUnit = GetMyBusinessUnit;
module.exports.UpdateBusinessUnitUserGroups = UpdateBusinessUnitUserGroups;
module.exports.AddDefaultBusinessUnit = AddDefaultBusinessUnit;
module.exports.RemoveHeadToBusinessUnits = RemoveHeadToBusinessUnits;
module.exports.GetUserCountOfBusinessUnit = GetUserCountOfBusinessUnit;
