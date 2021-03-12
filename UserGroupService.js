/**
 * Created by a on 7/23/2016.
 */
var mongoose = require('mongoose');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var UserGroup = require('dvp-mongomodels/model/UserGroup').UserGroup;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var User = require('dvp-mongomodels/model/User');
var regex = require('regex');
var util = require('util');
var _ = require('lodash');
var UserAccount = require('dvp-mongomodels/model/UserAccount');
//var ObjectId = mongoose.Types.ObjectId;
var auditTrailsHandler = require('dvp-common/AuditTrail/AuditTrailsHandler.js');

function addAuditTrail(tenantId, companyId, iss, auditData) {
    /*var auditData =  {
     KeyProperty: keyProperty,
     OldValue: auditTrails.OldValue,
     NewValue: auditTrails.NewValue,
     Description: auditTrails.Description,
     Author: auditTrails.Author,
     User: iss,
     OtherData: auditTrails.OtherData,
     ObjectType: auditTrails.ObjectType,
     Action: auditTrails.Action,
     Application: auditTrails.Application,
     TenantId: tenantId,
     CompanyId: companyId
     }*/

    try {
        auditTrailsHandler.CreateAuditTrails(tenantId, companyId, iss, auditData, function (err, obj) {
            if (err) {
                var jsonString = messageFormatter.FormatMessage(err, "Fail", false, auditData);
                logger.error('addAuditTrail -  Fail To Save Audit trail-[%s]', jsonString);
            }
        });
    }
    catch (ex) {
        var jsonString = messageFormatter.FormatMessage(ex, "Fail", false, auditData);
        logger.error('addAuditTrail -  insertion  failed-[%s]', jsonString);
    }
}

/*
 function GetUserGroups(req, res){


 logger.debug("DVP-UserService.GetUserGroups Internal method ");
 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;
 UserGroup.find({company: company, tenant: tenant}).populate('users', '-password -user_meta -app_meta -user_scopes -client_scopes').exec(  function(err, usergroups) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Get User Groups Failed", false, undefined);

 }else {

 if (usergroups) {


 jsonString = messageFormatter.FormatMessage(err, "Get User Groups Successful", true, usergroups);

 }else{

 jsonString = messageFormatter.FormatMessage(undefined, "No User Groups Found", false, undefined);

 }
 }

 res.end(jsonString);
 });

 }
 function GetUserGroup(req, res){


 logger.debug("DVP-UserService.GetUserGroup Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;


 UserGroup.findOne({_id: req.params.id,company: company, tenant: tenant}).populate('users', '-password -user_meta -app_meta -user_scopes -client_scopes').exec( function(err, usergroup) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Get User Group Failed", false, undefined);

 }else{

 if(usergroup) {
 var userObj;
 jsonString = messageFormatter.FormatMessage(err, "Get User Group Successful", true, usergroup);

 }else{

 jsonString = messageFormatter.FormatMessage(undefined, "No Get User Group found", false, undefined);

 }

 }

 res.end(jsonString);
 });

 }
 function DeleteUserGroup(req,res){


 logger.debug("DVP-UserService.DeleteUserGroup Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;
 UserGroup.findOneAndRemove({_id: req.params.id,company: company, tenant: tenant}, function(err, usergroup) {
 if (err) {
 jsonString = messageFormatter.FormatMessage(err, "Delete User Group Failed", false, undefined);
 }else{
 jsonString = messageFormatter.FormatMessage(undefined, "User Group Deleted Successfully", true, usergroup);
 }
 res.end(jsonString);
 });
 }
 function CreateUserGroup(req, res) {

 logger.debug("DVP-UserService.CreateUserGroup Internal method ");
 var jsonString;
 var tenant = parseInt(req.user.tenant);
 var company = parseInt(req.user.company);

 if(req.body && req.body.name ) {
 var userGroup = UserGroup({
 name: req.body.name,
 company: parseInt(req.user.company),
 tenant: parseInt(req.user.tenant),
 created_at: Date.now(),
 updated_at: Date.now()
 });


 userGroup.save(function (err, usergroup) {
 if (err) {
 jsonString = messageFormatter.FormatMessage(err, "User Group save failed", false, undefined);
 res.end(jsonString);
 } else {


 jsonString = messageFormatter.FormatMessage(undefined, "User Group saved successfully", true, usergroup);
 res.end(jsonString);
 }
 });
 }else{


 jsonString = messageFormatter.FormatMessage(undefined, "Require fields not found", false, undefined);
 res.end(jsonString);

 }
 }
 function UpdateUserGroup(req, res){


 logger.debug("DVP-UserService.UpdateUserGroup Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;

 req.body.updated_at = Date.now();
 UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant}, req.body, function(err, users) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Update User Groups Failed", false, undefined);

 }else{

 jsonString = messageFormatter.FormatMessage(err, "Update User Groups Successful", true, undefined);

 }

 res.end(jsonString);
 });

 }
 function UpdateUserGroupMembers(req, res) {

 logger.debug("DVP-UserService.UpdateUserGroupMembers Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;

 req.body.updated_at = Date.now();


 User.findOne({_id: req.params.user,company: company, tenant: tenant}, function(err, users) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);

 }else{

 if(users) {
 UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant}, { $addToSet :{users : req.params.user}}, function (err, users) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Update User Group Member Failed", false, undefined);

 } else {

 jsonString = messageFormatter.FormatMessage(undefined, "Update User Group Member Successful", true, undefined);

 }

 res.end(jsonString);
 });

 }else {


 jsonString = messageFormatter.FormatMessage(err, "Get User Failed", true, undefined);
 res.end(jsonString);
 }

 }


 });



 }
 function RemoveUserGroupMembers(req, res){

 logger.debug("DVP-UserService.RemoveUserGroupMembers Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;

 UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant},{ $pull: {users : req.params.user} }, function(err, users) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Remove User Group Member Failed", false, undefined);


 }else{

 jsonString = messageFormatter.FormatMessage(undefined, "Remove User Group Member successfully", true, undefined);

 }

 res.end(jsonString);


 });


 }
 function FindUserGroupsByMember(req, res) {

 logger.debug("DVP-UserService.FindUserGroupsByMember Internal method ");

 var company = parseInt(req.user.company);
 var tenant = parseInt(req.user.tenant);
 var jsonString;

 req.body.updated_at = Date.now();
 UserGroup.find({company: company, tenant: tenant,'users':req.params.user }, function (err, usergroups) {
 if (err) {

 jsonString = messageFormatter.FormatMessage(err, "Get User Group By Member Failed", false, undefined);

 } else {

 jsonString = messageFormatter.FormatMessage(undefined, "Get User Group By Member Successful", true, usergroups);

 }

 res.end(jsonString);
 });

 }

 */

///////////////////////new  method set for user single///////////////////////////////////////////////////////////////////////////////////////////////////////

function GetUserGroups(req, res){


    logger.debug("DVP-UserService.GetUserGroups Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    UserGroup.find({company: company, tenant: tenant}).populate('users','username').exec(function(err, usergroups) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Groups Failed", false, undefined);

        }else {

            if (usergroups) {


                jsonString = messageFormatter.FormatMessage(err, "Get User Groups Successful", true, usergroups);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "No User Groups Found", false, undefined);

            }
        }

        res.end(jsonString);
    });

}

function GetGroupsAndUsers(req, res){


    logger.debug("DVP-UserService.UpdateUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    var emptyArr = [];



    UserGroup.find({company: company, tenant: tenant}).populate('supervisors')
        .select({"password":0, "user_meta": 0, "app_meta":0, "user_scopes":0, "client_scopes":0})
        .lean()
        .exec( function(err, groups)
        {
            if (err)
            {
                jsonString = messageFormatter.FormatMessage(err, "Get Groups Failed", false, emptyArr);
                res.end(jsonString);
            }
            else
            {
                if (groups && groups.length > 0) {

                    var grpIdArr = _.map(groups, function(grp)
                    {
                        return grp._id.toString();
                    });
                    UserAccount.find({company: company, tenant: tenant, group: {$in: grpIdArr}}).populate('userref' , '-password')
                        .lean()
                        .exec( function(err, userAccounts)
                        {
                            if(err)
                            {
                                jsonString = messageFormatter.FormatMessage(err, "Get Groups Failed", false, emptyArr);
                                res.end(jsonString);
                            }
                            else
                            {
                                groups.forEach(function(grp)
                                {
                                    grp.users = _.filter(userAccounts, function(usrAcc)
                                    {
                                        if(usrAcc.group.toString() === grp._id.toString() && usrAcc.userref){
                                            var user = usrAcc.userref;

                                            //if(user && user._doc && user._doc.group)
                                            user.group = usrAcc.group;
                                            //if(user && user._doc && user._doc.active)
                                            user.active = usrAcc.active;
                                            //if(user && user._doc && user._doc.joined)
                                            user.joined = usrAcc.joined;
                                            //if(user && user._doc && user._doc.resource_id)
                                            user.resourceid = usrAcc.resource_id;
                                            //if(user && user._doc && user._doc.veeryaccount)
                                            user.veeryaccount = usrAcc.veeryaccount;
                                            //if(user && user._doc && user._doc.multi_login)
                                            user.multi_login = usrAcc.multi_login;

                                            return user;
                                        }
                                    });

                                    //grp.users = grpUsers;
                                });

                                jsonString = messageFormatter.FormatMessage(null, "Get Groups Successful", true, groups);
                                res.end(jsonString);
                            }


                        });

                }
                else
                {

                    jsonString = messageFormatter.FormatMessage(null, "No groups found", true, emptyArr);
                    res.end(jsonString);

                }
            }


        });

}

function GetUserGroup(req, res){


    logger.debug("DVP-UserService.GetUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    UserGroup.findOne({_id: req.params.id,company: company, tenant: tenant}).populate('users','username').exec(function(err, usergroup) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Group Failed", false, undefined);

        }else{

            if(usergroup) {
                var userObj;
                jsonString = messageFormatter.FormatMessage(err, "Get User Group Successful", true, usergroup);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "No Get User Group found", false, undefined);

            }

        }

        res.end(jsonString);
    });

}

function GetUserGroupByName(req, res){


    logger.debug("DVP-UserService.GetUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    UserGroup.findOne({name: req.params.name,company: company, tenant: tenant},function(err, usergroup) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Group Failed", false, undefined);

        }else{

            if(usergroup) {
                var userObj;
                jsonString = messageFormatter.FormatMessage(err, "Get User Group Successful", true, usergroup);

            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "No Get User Group found", false, undefined);

            }
        }
        res.end(jsonString);
    });

}

function DeleteUserGroup(req,res){


    logger.debug("DVP-UserService.DeleteUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    UserGroup.findOneAndRemove({_id: req.params.id,company: company, tenant: tenant}, function(err, usergroup) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Delete User Group Failed", false, undefined);
        }else{
            jsonString = messageFormatter.FormatMessage(undefined, "User Group Deleted Successfully", true, usergroup);
        }
        res.end(jsonString);
    });
}

function CreateUserGroup(req, res) {

    logger.debug("DVP-UserService.CreateUserGroup Internal method ");
    var jsonString;
    var tenant = parseInt(req.user.tenant);
    var company = parseInt(req.user.company);

    if(req.body && req.body.name ) {

        var userGroup = UserGroup({
            name: req.body.name,
            company: parseInt(req.user.company),
            tenant: parseInt(req.user.tenant),
            created_at: Date.now(),
            updated_at: Date.now()
        });

        if(req.body.businessUnit)
        {
            userGroup.businessUnit=req.body.businessUnit;
        }

        userGroup.save(function (err, usergroup) {
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "User Group save failed", false, undefined);
                res.end(jsonString);
            } else {


                jsonString = messageFormatter.FormatMessage(undefined, "User Group saved successfully", true, usergroup);
                res.end(jsonString);
            }
        });
    }else{


        jsonString = messageFormatter.FormatMessage(undefined, "Require fields not found", false, undefined);
        res.end(jsonString);

    }
}

function UpdateUserGroup(req, res){


    logger.debug("DVP-UserService.UpdateUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    req.body.updated_at = Date.now();
    UserGroup.findOneAndUpdate({_id: req.params.id,company: company, tenant: tenant}, req.body, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update User Groups Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Update User Groups Successful", true, undefined);

        }

        res.end(jsonString);
    });

}

function GetGroupMembers(req, res){


    logger.debug("DVP-UserService.UpdateUserGroup Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;


    /*
    UserAccount.find({company: company, tenant: tenant, group: req.params.id})
        .select({"password":0, "user_meta": 0, "app_meta":0, "user_scopes":0, "client_scopes":0})
        .exec( function(err, users) {
        */

    UserAccount.find({company: company, tenant: tenant, group: req.params.id}).populate('userref' , '-password')
        .exec( function(err, userAccounts) {
            if (err) {

                jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);

            }else {

                if (userAccounts) {

                    var users = userAccounts.map(function (userAccount) {
                        var user = undefined;

                        if(userAccount.userref) {
                            user = userAccount.userref.toObject();

                            //if(user && user._doc && user._doc.group)
                            user.group = userAccount.group;
                            //if(user && user._doc && user._doc.active)
                            user.active = userAccount.active;
                            //if(user && user._doc && user._doc.joined)
                            user.joined = userAccount.joined;
                            //if(user && user._doc && user._doc.resource_id)
                            user.resourceid = userAccount.resource_id;
                            //if(user && user._doc && user._doc.veeryaccount)
                            user.veeryaccount = userAccount.veeryaccount;
                            //if(user && user._doc && user._doc.multi_login)
                            user.multi_login = userAccount.multi_login;
                        }

                        return user;

                    });
                    jsonString = messageFormatter.FormatMessage(undefined, "Get Users Successful", true, users);

                }else{

                    jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);

                }
            }

            res.end(jsonString);
        });

}

function UpdateUserGroupMembers(req, res) {

    logger.debug("DVP-UserService.UpdateUserGroupMembers Internal method ");
    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    req.body.updated_at = Date.now();

    UserGroup.findOne({_id: req.params.id,company: company, tenant: tenant}, function(err, group) {
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "Get Group Failed", false, undefined);
        }else{

            if(group) {
                UserAccount.findOneAndUpdate({userref: req.params.user,company: company, tenant: tenant}, {group : group._id}, function (err, userAcount) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Update User Group Member Failed", false, undefined);
                    } else {
                        var user = {
                            active: userAcount.active,
                            verified: userAcount.verified,
                            multi_login: userAcount.multi_login,
                            _id: userAcount._id,
                            joined: userAcount.joined,
                            user: userAcount.user,
                            tenant: userAcount.tenant,
                            company: userAcount.company,
                            user_meta: userAcount.user_meta,
                            created_at: userAcount.created_at,
                            updated_at: userAcount.updated_at,
                            resource_id: userAcount.resource_id,
                            allowoutbound: userAcount.allowoutbound,
                            veeryaccount: userAcount.veeryaccount,
                            group: userAcount.group
                        };

                        var Newuser = {
                            active: userAcount.active,
                            verified: userAcount.verified,
                            multi_login: userAcount.multi_login,
                            _id: userAcount._id,
                            joined: userAcount.joined,
                            user: userAcount.user,
                            tenant: userAcount.tenant,
                            company: userAcount.company,
                            user_meta: userAcount.user_meta,
                            created_at: userAcount.created_at,
                            updated_at: userAcount.updated_at,
                            resource_id: userAcount.resource_id,
                            allowoutbound: userAcount.allowoutbound,
                            veeryaccount: userAcount.veeryaccount,
                            group: group._id
                        };
                        var auditData = {
                            KeyProperty: "Group",
                            OldValue: user,
                            NewValue: Newuser,
                            Description: "User added to User Group",
                            Author: req.user.iss,
                            User: userAcount.user,
                            ObjectType: "User",
                            Action: "UPDATE",
                            Application: "User Service"
                        };
                        addAuditTrail(tenant, company, req.user.iss, auditData);

                        jsonString = messageFormatter.FormatMessage(undefined, "Update User Group Member Successful", true, undefined);
                    }
                    res.end(jsonString);
                });

            }else {
                jsonString = messageFormatter.FormatMessage(err, "Get Group Failed", true, undefined);
                res.end(jsonString);
            }
        }
    });
}

function UpdateUserGroupSupervisors(req, res) {

    logger.debug("DVP-UserService.UpdateUserGroupSupervisors Internal method ");
    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;
        req.body.updated_at = Date.now();

        UserAccount.findOne({userref: req.params.user, company: company, tenant: tenant}).exec(function (errUser, resUserAccount) {

            if (errUser) {
                jsonString = messageFormatter.FormatMessage(errUser, "Get User Account Failed", false, undefined);
                res.end(jsonString);
            }
            else {
                if (resUserAccount) {
                    if (resUserAccount.user_meta && (resUserAccount.user_meta.role == "admin" || resUserAccount.user_meta.role == "supervisor")) {
                        UserGroup.findOneAndUpdate({
                            _id: req.params.id,
                            company: company,
                            tenant: tenant
                        }, {$push: {supervisors: resUser}}).exec(function (errGroup, resGroup) {

                            if (errGroup) {
                                jsonString = messageFormatter.FormatMessage(errGroup, "Get Group Failed", false, undefined);
                            }
                            else {
                                jsonString = messageFormatter.FormatMessage(undefined, "Update User Group Supervisors Successful", true, undefined);
                            }

                            res.end(jsonString);
                        });

                    }
                    else {
                        jsonString = messageFormatter.FormatMessage(errUser, "User is not recognized as a Supervisor or Admin ", false, undefined);
                        res.end(jsonString);
                    }
                }
                else {
                    jsonString = messageFormatter.FormatMessage(errUser, "No User found ", false, undefined);
                    res.end(jsonString);
                }
            }

        });
    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in operation", false, undefined);
        res.end(jsonString);
    }

}

function GetUserGroupSupervisors(req, res){


    logger.debug("DVP-UserService.GetUserGroupSupervisors Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;


        UserGroup.findOne({
            company: company,
            tenant: tenant,
            _id: req.params.id
        }).populate('supervisors', '-password -user_meta -app_meta -user_scopes -client_scopes').exec(function (errUsers, resUsers) {

            if (errUsers) {
                jsonString = messageFormatter.FormatMessage(errUsers, "Error in searching supervisors", false, undefined);
            }
            else {
                if (resUsers) {
                    jsonString = messageFormatter.FormatMessage(undefined, "Supervisors found", true, resUsers);
                }
                else {
                    jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);
                }
            }

            res.end(jsonString);
        });
    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in serching users", false, undefined);
        res.end(jsonString);
    }


}

function RemoveUserGroupMembers(req, res){

    logger.debug("DVP-UserService.RemoveUserGroupMembers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //User.update({_id: user._id}, {$unset: {field: 1 }}, callback);

    UserAccount.findOneAndUpdate({userref: req.params.user,company: company, tenant: tenant}, {$unset: {group: 1 }}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove User Group Member Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove User Group Member successfully", true, undefined);

        }

        res.end(jsonString);


    });


}

function FindUserGroupsByMember(req, res) {

    logger.debug("DVP-UserService.FindUserGroupsByMember Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    req.body.updated_at = Date.now();

    UserAccount.findOne({company: company, tenant: tenant, userref: req.params.user}, function(err, userAccount) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Users Failed", false, undefined);
            res.end(jsonString);

        }else {

            if (userAccount) {
                UserGroup.find({company: company, tenant: tenant,_id: userAccount.group}, function (err, usergroups) {
                    if (err) {
                        jsonString = messageFormatter.FormatMessage(err, "Get User Group By Member Failed", false, undefined);
                    } else {
                        jsonString = messageFormatter.FormatMessage(undefined, "Get User Group By Member Successful", true, usergroups);
                    }
                    res.end(jsonString);
                });
            }else{

                jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);
                res.end(jsonString);

            }
        }
    });
}

function GetSupervisorUserGroups(req, res){


    logger.debug("DVP-UserService.GetSupervisorUserGroups Internal method ");

    try {
        var company = parseInt(req.user.company);
        var tenant = parseInt(req.user.tenant);
        var jsonString;

        if(req.params.sid)
        {
            UserGroup.find({
                company: company,
                tenant: tenant,
                supervisors: {$in: [req.params.sid]}
            }).populate('supervisors', '-password -user_meta -app_meta -user_scopes -client_scopes').exec(function (errUsers, resUsers) {

                if (errUsers) {
                    logger.error("DVP-UserService.GetSupervisorUserGroups :  Error in searching supervisors ",errUsers);
                    jsonString = messageFormatter.FormatMessage(errUsers, "Error in searching supervisors", false, undefined);
                }
                else {
                    if (resUsers) {
                        jsonString = messageFormatter.FormatMessage(undefined, "Supervisors found", true, resUsers);
                        logger.debug("DVP-UserService.GetSupervisorUserGroups :  Supervisors found ");
                    }
                    else {
                        jsonString = messageFormatter.FormatMessage(undefined, "Get Users Failed", false, undefined);
                        logger.error("DVP-UserService.GetSupervisorUserGroups :  Get Users Failed ");
                    }
                }

                res.end(jsonString);
            });
        }
        else
        {
            logger.error("DVP-UserService.GetSupervisorUserGroups :  No supervisor ID found ");
            jsonString = messageFormatter.FormatMessage(new Error("No supervisor ID found"), "No supervisor ID found", false, undefined);
            res.end(jsonString);
        }


    } catch (e) {
        jsonString = messageFormatter.FormatMessage(e, "Exception in serching users", false, undefined);
        res.end(jsonString);
    }


}











module.exports.GetUserGroups = GetUserGroups;
module.exports.GetUserGroup = GetUserGroup;
module.exports.GetUserGroupByName = GetUserGroupByName;
module.exports.DeleteUserGroup = DeleteUserGroup;
module.exports.CreateUserGroup = CreateUserGroup;
module.exports.UpdateUserGroup = UpdateUserGroup;
module.exports.GetGroupMembers = GetGroupMembers;
module.exports.UpdateUserGroupMembers = UpdateUserGroupMembers;
module.exports.RemoveUserGroupMembers = RemoveUserGroupMembers;
module.exports.FindUserGroupsByMember = FindUserGroupsByMember;
module.exports.GetGroupsAndUsers = GetGroupsAndUsers;
module.exports.UpdateUserGroupSupervisors = UpdateUserGroupSupervisors;
module.exports.GetUserGroupSupervisors = GetUserGroupSupervisors;
module.exports.GetSupervisorUserGroups = GetSupervisorUserGroups;




