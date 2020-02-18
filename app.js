

var express = require('express');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
var session = require('express-session');
var cors = require('cors');
var app = express();

var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var userService = require("./UserService.js");
var clientService = require("./ClientService");
var phoneConfig = require("./PhoneConfig");
var config = require('config');
var jwt = require('restify-jwt');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
var ActiveDirectory = require('./ActiveDirectoryService');
var UserInvitationService = require("./UserInvitationService");
var healthcheck = require('dvp-healthcheck/DBHealthChecker');

// tenant operations
var mongomodels = require('dvp-mongomodels');

var port = config.Host.port || 3000;
var host = config.Host.vdomain || 'localhost';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'keyboard cat', resave: true, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.use(errorhandler({ dumpExceptions: true, showStack: true }));

var hc = new healthcheck(app, {redis: userService.RedisCon, pg: userService.DbConn, mongo: mongomodels.connection});
hc.Initiate();

app.get('/DVP/API/:version/Owner/:name/exists', userService.OwnerExists);

app.get('/DVP/API/:version/Users', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUsers);
app.get('/DVP/API/:version/UserCount', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUserCount);
app.get('/DVP/API/:version/User/:name', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUser);
app.get('/DVP/API/:version/User/:name/Operations/:Action', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.UserIsAllowToOutbound);
app.get('/DVP/API/:version/UsersByIds', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUsersByIDs);
app.get('/DVP/API/:version/UsersByRole/:role', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUsersByRole);
app.post('/DVP/API/:version/UsersByRoles', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUsersByRoles);

app.get('/DVP/API/:version/User/:name/exsists', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.UserExists);
app.get('/DVP/API/:version/User/:name/invitable', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.UserInvitable);
app.get('/DVP/API/:version/Users/invitable', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.UserInvitable);
app.get('/DVP/API/:version/UserAccount/:name/exsists', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.UserAccountExists);

app.delete('/DVP/API/:version/User/:name', jwt({secret: secret.Secret}),authorization({resource:"user", action:"delete"}), userService.DeleteUser);
app.put('/DVP/API/:version/User/ReActivate/:username', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.ReActivateUser);
app.post('/DVP/API/:version/User', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.CreateUser);
app.put('/DVP/API/:version/User/:name', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.UpdateUser);
app.put('/DVP/API/:version/User/FileCategory/:category', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.AddFileCategoryToUser);
app.put('/DVP/API/:version/User/:user/FileCategory/:category', jwt({secret: secret.Secret}),authorization({resource:"userfilecategory", action:"write"}), userService.AddFileCategoryToSpecificUser);
/*app.put('/DVP/API/:version/User/Allow/FileCategories', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.AddFileCategoriesToUser);*/
app.delete('/DVP/API/:version/User/FileCategory/:category', jwt({secret: secret.Secret}),authorization({resource:"userfilecategory", action:"delete"}), userService.RemoveFileCategoryFromUser);
app.delete('/DVP/API/:version/User/:user/FileCategory/:category', jwt({secret: secret.Secret}),authorization({resource:"userfilecategory", action:"delete"}), userService.RemoveFileCategoryFromSpecificUser);
app.get('/DVP/API/:version/FileCategories', jwt({secret: secret.Secret}),authorization({resource:"userfilecategory", action:"read"}), userService.GetFileCategories);

//app.post('/DVP/API/:version/User', jwt({secret: secret.Secret}),authorization({resource:"externaluser", action:"write"}), userService.CreateExternalUser);

//////////////////////////////Organisation API/////////////////////////////////////////////////////

app.get('/DVP/API/:version/Myprofile',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"read"}),userService.GetMyrProfile);
app.get('/DVP/API/:version/Mylocation',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}),userService.SetMyLocation);
app.get('/DVP/API/:version/Mylanguages',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}),userService.GetMyLanguages);

app.put('/DVP/API/:version/User/:name/location',jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}),userService.SetLocation);
app.get('/DVP/API/:version/User/:name/profile', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"read"}), userService.GetUserProfile);
app.get('/DVP/API/:version/User/profilebycontact/:category/:contact', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"read"}), userService.GetUserProfileByContact);
app.get('/DVP/API/:version/User/profilebyresourceid/:resourceid', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"read"}), userService.GetUserProfileByResourceId);
app.get('/DVP/API/:version/User/:name/profile/veeryformat/:contact', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"read"}), userService.GetARDSFriendlyContactObject);
app.get('/DVP/API/:version/Myprofile/veeryformat/:contact', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"read"}), userService.GetMyARDSFriendlyContactObject);

app.put('/DVP/API/:version/User/:name/profile', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}), userService.UpdateUserProfile);
app.put('/DVP/API/:version/Myprofile', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}), userService.UpdateMyUserProfile);
app.put('/DVP/API/:version/Myprofile/Password', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}), userService.UpdateMyPassword);

app.put('/DVP/API/:version/User/:name/profile/resource/:resourceid', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}), userService.SetUserProfileResourceId);

app.put('/DVP/API/:version/User/:name/profile/password', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}), userService.UpdateUserProfilePassword);
app.put('/DVP/API/:version/User/:name/profile/email/:email', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}), userService.UpdateUserProfileEmail);
app.put('/DVP/API/:version/User/:name/profile/phonen/:number', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}), userService.UpdateUserProfilePhone);
app.put('/DVP/API/:version/User/:name/profile/contact/:contact', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"write"}), userService.UpdateUserProfileContact);
app.delete('/DVP/API/:version/User/:name/profile/contact/:contact', jwt({secret: secret.Secret}),authorization({resource:"userProfile", action:"delete"}), userService.RemoveUserProfileContact);

app.put('/DVP/API/:version/Myprofile/contact/:contact', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}), userService.UpdateMyUserProfileContact);
app.delete('/DVP/API/:version/Myprofile/contact/:contact', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"delete"}), userService.RemoveMyUserProfileContact);

app.get('/DVP/API/:version/Users/:name/Scope',jwt({secret: secret.Secret}), authorization({resource:"userScope", action:"read"}), userService.GetUserScopes);
app.put('/DVP/API/:version/Users/:name/Scope', jwt({secret: secret.Secret}),authorization({resource:"userScope", action:"write"}), userService.AddUserScopes);
app.delete('/DVP/API/:version/User/:username/Scope/:scope', jwt({secret: secret.Secret}),authorization({resource:"userScope", action:"delete"}), userService.RemoveUserScopes);

app.get('/DVP/API/:version/Users/:name/AppScope',jwt({secret: secret.Secret}), authorization({resource:"userAppScope", action:"read"}), userService.GetAppScopes);
app.get('/DVP/API/:version/MyAppScopes/MyAppScopes/:console',jwt({secret: secret.Secret}), authorization({resource:"myNavigation", action:"read"}), userService.GetMyAppScopesByConsole);
app.get('/DVP/API/:version/MyAppScopes/:consoles',jwt({secret: secret.Secret}), authorization({resource:"myNavigation", action:"read"}), userService.GetMyAppScopesByConsoles);

app.delete('/DVP/API/:version/User/:username/Console/:consoleName/Navigation/:navigation', jwt({secret: secret.Secret}),authorization({resource:"userAppScope", action:"delete"}), userService.RemoveUserAppScopes);
app.put('/DVP/API/:version/User/:username/Console/:consoleName/Navigation', jwt({secret: secret.Secret}),authorization({resource:"userAppScope", action:"write"}), userService.AddUserAppScopes);
app.delete('/DVP/API/:version/User/:username/Console/:consoleName', jwt({secret: secret.Secret}),authorization({resource:"userAppScope", action:"delete"}), userService.RemoveConsoleFromUser);
app.put('/DVP/API/:version/User/:username/Console/:consoleName', jwt({secret: secret.Secret}),authorization({resource:"userAppScope", action:"write"}), userService.AssignConsoleToUser);

app.get('/DVP/API/:version/Users/:name/UserMeta', jwt({secret: secret.Secret}),authorization({resource:"userMeta", action:"read"}), userService.GetUserMeta);
app.put('/DVP/API/:version/Users/:name/UserMeta', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}), userService.UpdateUserMetadata);
app.delete('/DVP/API/:version/Users/:name/UserMeta/:usermeta', jwt({secret: secret.Secret}),authorization({resource:"userMeta", action:"delete"}), userService.RemoveUserMetadata);

app.get('/DVP/API/:version/Users/:name/AppMeta', jwt({secret: secret.Secret}),authorization({resource:"userAppMeta", action:"read"}), userService.GetAppMeta);
app.put('/DVP/API/:version/Users/:name/AppMeta', jwt({secret: secret.Secret}),authorization({resource:"userAppMeta", action:"write"}), userService.UpdateAppMetadata);
app.delete('/DVP/API/:version/Users/:name/AppMeta/:appmeta', jwt({secret: secret.Secret}),authorization({resource:"userAppMeta", action:"delete"}), userService.RemoveAppMetadata);

app.put('/DVP/API/:version/MyAppMeta', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}), userService.UpdateMyAppMetadata);
app.get('/DVP/API/:version/MyAppMeta', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"read"}), userService.GetMyAppMetadata);

app.get('/DVP/API/:version/Clients', jwt({secret: secret.Secret}),authorization({resource:"client", action:"read"}), clientService.GetClients);
app.get('/DVP/API/:version/Client/:clientid', jwt({secret: secret.Secret}),authorization({resource:"client", action:"read"}), clientService.GetClient);
app.delete('/DVP/API/:version/Client/:clientid', jwt({secret: secret.Secret}),authorization({resource:"client", action:"delete"}), clientService.DeleteClient);
app.post('/DVP/API/:version/Client', jwt({secret: secret.Secret}),authorization({resource:"client", action:"write"}), clientService.CreateClient);

app.get('/DVP/API/:version/Client/:id/claims',jwt({secret: secret.Secret}), authorization({resource:"clientScope", action:"read"}), clientService.GetClientClaims);
app.put('/DVP/API/:version/Client/:id/claim', jwt({secret: secret.Secret}),authorization({resource:"clientScope", action:"write"}), clientService.AddClientClaim);
app.delete('/DVP/API/:version/Client/:id/claim/:claim', jwt({secret: secret.Secret}),authorization({resource:"clientScope", action:"delete"}), clientService.RemoveClientClaim);

app.post('/DVP/API/:version/Chat/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"write"}), phoneConfig.UpdateChatConfig);
app.get('/DVP/API/:version/Chat/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"write"}), phoneConfig.GetChatConfig);

app.post('/DVP/API/:version/Phone/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"write"}), phoneConfig.AddPhoneConfig);
app.get('/DVP/API/:version/Phone/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"read"}), phoneConfig.GetPhoneConfig);
app.put('/DVP/API/:version/Phone/:id/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"read"}), phoneConfig.UpdatePhoneConfig);
app.delete('/DVP/API/:version/Phone/:id/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"write"}), phoneConfig.DeletePhoneConfig);

app.post('/DVP/API/:version/CustomerTag',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"write"}), userService.CreateUserTag);
app.get('/DVP/API/:version/CustomerTags',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"read"}), userService.GetUserTags);
app.get('/DVP/API/:version/CustomerTag/:tag',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"write"}), userService.GetUserTag);
app.delete('/DVP/API/:version/CustomerTag/:tag',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"write"}), userService.RemoveUserTag);

app.get('/DVP/API/:version/Tenant/Monitoring/superUsers', jwt({secret: secret.Secret}),authorization({resource:"tenant", action:"read"}), userService.GetSuperUsers);

//--------------------------------Active Directory Configuration-------------------------------------------------

app.post('/DVP/API/:version/ActiveDirectory',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"write"}), ActiveDirectory.CreateActiveDirectory);
app.put('/DVP/API/:version/ActiveDirectory/:adId',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"write"}), ActiveDirectory.UpdateActiveDirectory);
app.put('/DVP/API/:version/ActiveDirectory/:adId/ResetPassword',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"write"}), ActiveDirectory.ResetActiveDirectoryPassword);
app.delete('/DVP/API/:version/ActiveDirectory/:adId',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"delete"}), ActiveDirectory.RemoveActiveDirectory);
app.get('/DVP/API/:version/ActiveDirectory',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"read"}), ActiveDirectory.GetActiveDirectory);
app.get('/DVP/API/:version/ActiveDirectory/Group/Users',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"read"}), ActiveDirectory.GetUsersForGroup);

app.post('/DVP/API/:version/ActiveDirectory/FaceTone/User', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.CreateUserFromAD);

app.get('/DVP/API/:version/ReceivedInvitations',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.GetMyReceivedInvitations);
app.get('/DVP/API/:version/SendInvitations',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.GetMySendInvitations);
app.post('/DVP/API/:version/Invitations',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.CreateInvitations);
app.post('/DVP/API/:version/RequestInvitations',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.RequestInvitations);
app.post('/DVP/API/:version/Invitation/to/:to',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),UserInvitationService.CreateInvitation);
app.get('/DVP/API/:version/Invitation/:id',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.GetInvitation);
app.put('/DVP/API/:version/Invitation/Accept/:id/company/:company/tenant/:tenant',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}),UserInvitationService.AcceptUserInvitation);
app.put('/DVP/API/:version/Invitation/Reject/:id/company/:company/tenant/:tenant',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}),UserInvitationService.RejectUserInvitation);
app.put('/DVP/API/:version/Invitation/Cancel/:id',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),UserInvitationService.CancelUserInvitation);
app.put('/DVP/API/:version/Invitation/Resend/:id',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),UserInvitationService.ResendUserInvitation);

app.put('/DVP/API/:version/UserAccount/:username/Activation/:state',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),userService.UserAcccountActivation);

app.post('/DVP/API/:version/UserAccount/DataMigrate/Domain',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),userService.UpdateUsersVeeryAccountDomain);

app.put('/DVP/API/:version/ReportUser/:username/Console/:consoleName/Navigation', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.CreateReportUser);

app.post('/DVP/API/:version/UsersByRoles/Count', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUserCountByRoles);
app.get('/DVP/API/:version/UsersByRole/:role/Count', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), userService.GetUsersCountByRole);

app.listen(port, function () {
    logger.info("DVP-UserService.main Server listening at %d", port);
});


























/*


 var server = restify.createServer({
 name: "DVP User Service"
 });

 server.pre(restify.pre.userAgentConnection());
 server.use(restify.bodyParser({ mapParams: false }));
 restify.CORS.ALLOW_HEADERS.push('authorization');
 server.use(restify.CORS());
 server.use(restify.fullResponse());
 server.use(jwt({secret: secret.Secret}));


 //////////////////////////////Cloud API/////////////////////////////////////////////////////

 server.get('/DVP/API/:version/Users', authorization({resource:"user", action:"read"}), userService.GetUsers);
 server.get('/DVP/API/:version/User/:name', authorization({resource:"user", action:"read"}), userService.GetUser);
 server.del('/DVP/API/:version/User/:name', authorization({resource:"user", action:"delete"}), userService.DeleteUser);
 server.post('/DVP/API/:version/User', authorization({resource:"user", action:"write"}), userService.CreateUser);
 server.put('/DVP/API/:version/User/:name', authorization({resource:"user", action:"write"}), userService.UpdateUser);

 //////////////////////////////Organisation API/////////////////////////////////////////////////////
 server.get('/DVP/API/:version/User/:name/profile', authorization({resource:"userProfile", action:"read"}), userService.GetUserProfile);
 server.put('/DVP/API/:version/User/:name/profile', authorization({resource:"userProfile", action:"write"}), userService.UpdateUserProfile);

 server.get('/DVP/API/:version/Organisations', authorization({resource:"user", action:"read"}), organisationService.GetOrganisations);
 server.get('/DVP/API/:version/Organisation', authorization({resource:"user", action:"read"}), organisationService.GetOrganisation);
 server.del('/DVP/API/:version/Organisation', authorization({resource:"user", action:"delete"}), organisationService.DeleteOrganisation);
 server.post('/DVP/API/:version/Organisation', authorization({resource:"user", action:"write"}), organisationService.CreateOrganisation);
 server.patch('/DVP/API/:version/Organisation', authorization({resource:"user", action:"write"}), organisationService.UpdateOrganisation);

 server.get('/DVP/API/:version/Users/:name/Scope', authorization({resource:"userScope", action:"write"}), userService.GetUserScopes);
 server.put('/DVP/API/:version/Users/:name/Scope', authorization({resource:"userScope", action:"write"}), userService.AddUserScopes);
 server.del('/DVP/API/:version/User/:name/Scope/:scope', authorization({resource:"userScope", action:"delete"}), userService.DeleteUser);

 server.get('/DVP/API/:version/Users/:name/Scope', authorization({resource:"userAppScope", action:"write"}), userService.GetAppScopes);
 server.put('/DVP/API/:version/Users/:name/AppScope', authorization({resource:"userAppScope", action:"write"}), userService.AddUserAppScopes);
 server.del('/DVP/API/:version/User/:name/AppScope/:scope', authorization({resource:"userAppScope", action:"delete"}), userService.RemoveUserAppScopes);


 server.get('/DVP/API/:version/Users/:name/UserMeta', authorization({resource:"userMeta", action:"read"}), userService.GetUserMeta);
 server.put('/DVP/API/:version/Users/:name/UserMeta', authorization({resource:"userMeta", action:"write"}), userService.UpdateUserMetadata);

 server.get('/DVP/API/:version/Users/:name/AppMeta', authorization({resource:"userAppMeta", action:"read"}), userService.GetAppMeta);
 server.put('/DVP/API/:version/Users/:name/AppMeta', authorization({resource:"userAppMeta", action:"write"}), userService.UpdateAppMetadata);




 server.listen(port, function () {

 logger.info("DVP-UserService.main Server %s listening at %s", server.name, server.url);

 });

 */
