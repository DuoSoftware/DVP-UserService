

var express = require('express');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
var session = require('express-session');
var qs = require('qs');
var site = require('./sites');
var oauth2 = require('./oauth2');
var url = require('url');
require('./auth');
var ejwt = require('express-jwt');
var cors = require('cors');
var app = express();





var restify = require('restify');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var userService = require("./UserService.js");
var clientService = require("./ClientService");
var organisationService = require("./OrganisationService");
var resourceService = require("./ResourceService");
var packageService = require("./PackageService");
var navigationService = require('./NavigationService');
var externalUserService = require("./ExternalUserService");
var userGroupService = require("./UserGroupService");
var phoneConfig = require("./PhoneConfig");
var config = require('config');
var jwt = require('restify-jwt');
var util = require('util');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
var Login = require("./Login");
var ActiveDirectory = require('./ActiveDirectoryService');
var UserInvitationService = require("./UserInvitationService")

// tenant operations
var tenantService=require("./TenantService");
var businessUnitService=require("./BusinessUnitService");


//var mongoip=config.Mongo.ip;
//var mongoport=config.Mongo.port;
//var mongodb=config.Mongo.dbname;
//var mongouser=config.Mongo.user;
//var mongopass = config.Mongo.password;
//var mongoose = require('mongoose');
//var connectionstring = util.format('mongodb://%s:%s@%s:%d/%s',mongouser,mongopass,mongoip,mongoport,mongodb)
//mongoose.connect(connectionstring);
//
//mongoose.connection.once('open', function() {
//    console.log("Connected to db");
//});


var util = require('util');
var mongoip=config.Mongo.ip;
var mongoport=config.Mongo.port;
var mongodb=config.Mongo.dbname;
var mongouser=config.Mongo.user;
var mongopass = config.Mongo.password;
var mongoreplicaset= config.Mongo.replicaset;

var mongoose = require('mongoose');
var connectionstring = '';
mongoip = mongoip.split(',');

if(util.isArray(mongoip)){
    if(mongoip.length > 1){
        mongoip.forEach(function(item){
            connectionstring += util.format('%s:%d,',item,mongoport)
        });

        connectionstring = connectionstring.substring(0, connectionstring.length - 1);
        connectionstring = util.format('mongodb://%s:%s@%s/%s',mongouser,mongopass,connectionstring,mongodb);

        if(mongoreplicaset){
            connectionstring = util.format('%s?replicaSet=%s',connectionstring,mongoreplicaset) ;
        }
    }
    else
    {
        connectionstring = util.format('mongodb://%s:%s@%s:%d/%s',mongouser,mongopass,mongoip[0],mongoport,mongodb);
    }
}else{

    connectionstring = util.format('mongodb://%s:%s@%s:%d/%s',mongouser,mongopass,mongoip,mongoport,mongodb);
}

console.log(connectionstring);
mongoose.connect(connectionstring,{server:{auto_reconnect:true}});


mongoose.connection.on('error', function (err) {
    console.error( new Error(err));
    mongoose.disconnect();

});

mongoose.connection.on('opening', function() {
    console.log("reconnecting... %d", mongoose.connection.readyState);
});


mongoose.connection.on('disconnected', function() {
    console.error( new Error('Could not connect to database'));
    mongoose.connect(connectionstring,{server:{auto_reconnect:true}});
});

mongoose.connection.once('open', function() {
    console.log("Connected to db");

});


mongoose.connection.on('reconnected', function () {
    console.log('MongoDB reconnected!');
});



process.on('SIGINT', function() {
    mongoose.connection.close(function () {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});


var port = config.Host.port || 3000;
var host = config.Host.vdomain || 'localhost';



app.set('view engine', 'ejs');



//var router = express.Router();

/*
 router.use(function (req, res, next) {
 var url_parts = url.parse(req.url, true);
 req.query = url_parts.query;
 next();
 });
 */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'keyboard cat', resave: true, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.use(errorhandler({ dumpExceptions: true, showStack: true }));
app.use(cors());




app.get('/', site.index);
app.get('/login', site.loginForm);
app.post('/login', site.login);
app.get('/logout', site.logout);
app.get('/account', site.account);


app.get('/oauth/authorize', oauth2.authorization);
app.get('/dialog/authorize', oauth2.authorization);
app.post('/dialog/authorize/decision', oauth2.decision);
app.post('/oauth/token', oauth2.token);
app.delete('/oauth/token/revoke/:jti', jwt({secret: secret.Secret}), oauth2.revoketoken);


app.post('/auth/login', Login.Login);
app.post('/auth/verify', Login.Validation);
app.post('/auth/signup', Login.SignUP);
app.post('/auth/forget', Login.ForgetPassword);
app.post('/auth/forget/token', Login.ForgetPasswordToken);
app.post('/auth/reset/:token', Login.ResetPassword);
app.get('/auth/token/:token/exists', Login.CheckToken);
app.get('/auth/activate/:token', Login.ActivateAccount);
app.post('/auth/attachments', Login.Attachments);



app.post('/auth/google', Login.Google);
app.post('/auth/github', Login.GitHub);
app.post('/auth/facebook',Login.Facebook);



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
app.get('/DVP/API/:version/Organisation/Name/:tenant/:company', jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"read"}), organisationService.GetOrganisationName);
app.get('/DVP/API/:version/Organisations', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"read"}), organisationService.GetOrganisations);
app.get('/DVP/API/:version/Organisations/:page/:size', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"read"}), organisationService.GetOrganisationsWithPaging);
app.get('/DVP/API/:version/Organisation', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"read"}), organisationService.GetOrganisation);
app.delete('/DVP/API/:version/Organisation', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"delete"}), organisationService.DeleteOrganisation);
app.put('/DVP/API/:version/Organisation/Activate/:state', jwt({secret: secret.Secret}),authorization({resource:"organisationManage", action:"write"}), organisationService.ActivateOrganisation);


//app.post('/DVP/API/:version/Organisation', passport.authenticate('local', { session: false }), organisationService.CreateOrganisation);



app.get('/DVP/API/:version/Organization/:company/exists', organisationService.IsOrganizationExists);

//app.post('/DVP/API/:version/Organisation/Owner', organisationService.CreateOwner);
app.put('/DVP/API/:version/Organisation', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"write"}), organisationService.UpdateOrganisation);
app.put('/DVP/API/:version/Organisation/Package/:packageName', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"write"}), organisationService.AssignPackageToOrganisation);
app.delete('/DVP/API/:version/Organisation/Package/:packageName', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"write"}), organisationService.RemovePackageFromOrganisation);
app.get('/DVP/API/:version/MyOrganization/mypackages', jwt({secret: secret.Secret}),authorization({resource:"package", action:"read"}), organisationService.GetOrganisationPackages);
app.get('/DVP/API/:version/Organisation/billingInformation', jwt({secret: secret.Secret}),authorization({resource:"package", action:"read"}), organisationService.GetBillingDetails);

app.put('/DVP/API/:version/Organisation/Package/:packageName/Unit/:unitName/:topUpCount', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"write"}), organisationService.AssignPackageUnitToOrganisation);

app.get('/DVP/API/:version/Organisation/SpaceLimit/:spaceType', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"read"}), organisationService.GetSpaceLimit);
app.get('/DVP/API/:version/Organisation/SpaceLimits/:spaceType', jwt({secret: secret.Secret}),authorization({resource:"organisation", action:"read"}), organisationService.GetSpaceLimitForTenant);

app.get('/DVP/API/:version/Resources', jwt({secret: secret.Secret}),authorization({resource:"resource", action:"read"}), resourceService.GetResources);
app.get('/DVP/API/:version/Resource/:resourceName', jwt({secret: secret.Secret}),authorization({resource:"resource", action:"read"}), resourceService.GetResource);
app.delete('/DVP/API/:version/Resource/:resourceName', jwt({secret: secret.Secret}),authorization({resource:"resource", action:"delete"}), resourceService.DeleteResource);
app.post('/DVP/API/:version/Resource', jwt({secret: secret.Secret}),authorization({resource:"resource", action:"write"}), resourceService.CreateResource);
app.put('/DVP/API/:version/Resource/:resourceName', jwt({secret: secret.Secret}),authorization({resource:"resource", action:"write"}), resourceService.UpdateResource);

app.get('/DVP/API/:version/Packages', jwt({secret: secret.Secret}),authorization({resource:"package", action:"read"}), packageService.GetPackages);
app.get('/DVP/API/:version/Package/:packageName', jwt({secret: secret.Secret}),authorization({resource:"package", action:"read"}), packageService.GetPackage);
app.delete('/DVP/API/:version/Package/:packageName', jwt({secret: secret.Secret}),authorization({resource:"package", action:"delete"}), packageService.DeletePackage);
app.post('/DVP/API/:version/Package', jwt({secret: secret.Secret}),authorization({resource:"package", action:"write"}), packageService.CreatePackage);
app.put('/DVP/API/:version/Package/:packageName', jwt({secret: secret.Secret}),authorization({resource:"package", action:"write"}), packageService.UpdatePackage);

app.get('/DVP/API/:version/PackageUnits', jwt({secret: secret.Secret}),authorization({resource:"package", action:"read"}), packageService.GetPackageUnits);
app.get('/DVP/API/:version/PackageUnit/:unitName', jwt({secret: secret.Secret}),authorization({resource:"package", action:"read"}), packageService.GetPackageUnit);
app.delete('/DVP/API/:version/PackageUnit/:unitName', jwt({secret: secret.Secret}),authorization({resource:"package", action:"delete"}), packageService.DeletePackageUnit);
app.post('/DVP/API/:version/PackageUnit', jwt({secret: secret.Secret}),authorization({resource:"package", action:"write"}), packageService.CreatePackageUnit);
app.put('/DVP/API/:version/PackageUnit/:unitName', jwt({secret: secret.Secret}),authorization({resource:"package", action:"write"}), packageService.UpdatePackageUnit);



app.get('/DVP/API/:version/Consoles', jwt({secret: secret.Secret}),authorization({resource:"console", action:"read"}), navigationService.GetAllConsoles);
app.get('/DVP/API/:version/Consoles/:roleType', jwt({secret: secret.Secret}),authorization({resource:"console", action:"read"}), navigationService.GetAllConsolesByUserRole);
app.get('/DVP/API/:version/Console/:consoleName', jwt({secret: secret.Secret}),authorization({resource:"console", action:"read"}), navigationService.GetConsole);
app.delete('/DVP/API/:version/Console/:consoleName', jwt({secret: secret.Secret}),authorization({resource:"console", action:"delete"}), navigationService.DeleteConsole);
app.post('/DVP/API/:version/Console', jwt({secret: secret.Secret}),authorization({resource:"console", action:"write"}), navigationService.CreateConsole);
app.put('/DVP/API/:version/Console/:consoleName', jwt({secret: secret.Secret}),authorization({resource:"console", action:"write"}), navigationService.UpdateConsole);
app.put('/DVP/API/:version/Console/:consoleName/Navigation', jwt({secret: secret.Secret}),authorization({resource:"console", action:"write"}), navigationService.AddNavigationToConsole);
app.delete('/DVP/API/:version/Console/:consoleName/Navigation/:navigationName', jwt({secret: secret.Secret}),authorization({resource:"console", action:"write"}), navigationService.RemoveNavigationFromConsole);


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


//
app.post('/DVP/API/:version/BulkExternalUser',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.BulkCreate);
app.get('/DVP/API/:version/ExternalUsers',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUsers);
app.get('/DVP/API/:version/ExternalUsersByTags',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUsersByTags);
app.get('/DVP/API/:version/ExternalUser/:id',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUser);
app.get('/DVP/API/:version/ExternalUser/:id/attribute/:attribute',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUserAttribute);
app.put('/DVP/API/:version/ExternalUser/:id/attribute/:attribute/value/:value',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUserAttribute);




app.delete('/DVP/API/:version/ExternalUser/:id',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"delete"}), externalUserService.DeleteExternalUser);
app.post('/DVP/API/:version/ExternalUser',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.CreateExternalUser);
app.put('/DVP/API/:version/ExternalUser/:id',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUser);
app.get('/DVP/API/:version/ExternalUser/ByContact/:category/:contact',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUserProfileByContact);
app.get('/DVP/API/:version/ExternalUser/ByContactInteraction/:category/:contact',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUserProfileByInteraction);
app.get('/DVP/API/:version/ExternalUser/ByField/:field/:value',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUserProfileByField);
app.put('/DVP/API/:version/ExternalUser/:id/Contact/:contact',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUserProfileContact);
app.put('/DVP/API/:version/ExternalUser/:id/Email/:email',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUserProfileEmail);
app.delete('/DVP/API/:version/ExternalUser/:id/Contact/:contact',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"delete"}), externalUserService.RemoveExternalUserProfileContact);
app.put('/DVP/API/:version/ExternalUser/:id/Phone/:phone',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUserProfilePhone);
app.get('/DVP/API/:version/ExternalUser/BySSN/:ssn',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.GetExternalUserProfileBySSN);
app.get('/DVP/API/:version/ExternalUser/Search/:text',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"read"}), externalUserService.SearchExternalUsers);
app.put('/DVP/API/:version/ExternalUser/:id/DynamicFields',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUserProfileDynamicFields);
//app.delete('/DVP/API/:version/ExternalUser/:id/DynamicFields/:field',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateExternalUserProfileDynamicFields);
app.put('/DVP/API/:version/ExternalUser/:id/FormSubmission',jwt({secret: secret.Secret}), authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateFormSubmission);


app.post('/DVP/API/:version/UserGroup',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"write"}), userGroupService.CreateUserGroup);
app.get('/DVP/API/:version/UserGroups',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), userGroupService.GetGroupsAndUsers);
app.get('/DVP/API/:version/UserGroup/:id',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), userGroupService.GetUserGroup);
app.get('/DVP/API/:version/UserGroup/:id/members',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), userGroupService.GetGroupMembers);
app.get('/DVP/API/:version/UserGroupByName/:name',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), userGroupService.GetUserGroupByName);
app.delete('/DVP/API/:version/UserGroup/:id',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"delete"}), userGroupService.DeleteUserGroup);
app.put('/DVP/API/:version/UserGroup/:id',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"write"}), userGroupService.UpdateUserGroup);
app.put('/DVP/API/:version/UserGroup/:id/User/:user',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"write"}), userGroupService.UpdateUserGroupMembers);
app.delete('/DVP/API/:version/UserGroup/:id/User/:user',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"delete"}), userGroupService.RemoveUserGroupMembers);
app.post('/DVP/API/:version/UserGroup/User/:user',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"get"}), userGroupService.FindUserGroupsByMember);

app.put('/DVP/API/:version/UserGroup/:id/Supervisor/:user',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"write"}), userGroupService.UpdateUserGroupSupervisors);
app.get('/DVP/API/:version/UserGroup/:id/Supervisors',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"write"}), userGroupService.GetUserGroupSupervisors);


app.post('/DVP/API/:version/Tenant',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"write"}), tenantService.CreateTenant);
app.get('/DVP/API/:version/Tenants',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), tenantService.GetAllTenants);
app.get('/DVP/API/:version/Tenant/:id',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), tenantService.GetTenant);
app.get('/DVP/API/:version/CompanyDomain/:companyname',jwt({secret: secret.Secret}), authorization({resource:"userGroup", action:"read"}), tenantService.GetCompanyDomain);

app.post('/DVP/API/:version/Phone/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"write"}), phoneConfig.AddPhoneConfig);
app.get('/DVP/API/:version/Phone/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"read"}), phoneConfig.GetPhoneConfig);
app.put('/DVP/API/:version/Phone/:id/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"read"}), phoneConfig.UpdatePhoneConfig);
app.delete('/DVP/API/:version/Phone/:id/Config',jwt({secret: secret.Secret}), authorization({resource:"myUserProfile", action:"write"}), phoneConfig.DeletePhoneConfig);


app.post('/DVP/API/:version/CustomerTag',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"write"}), userService.CreateUserTag);
app.get('/DVP/API/:version/CustomerTags',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"read"}), userService.GetUserTags);
app.get('/DVP/API/:version/CustomerTag/:tag',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"write"}), userService.GetUserTag);
app.delete('/DVP/API/:version/CustomerTag/:tag',jwt({secret: secret.Secret}), authorization({resource:"tag", action:"write"}), userService.RemoveUserTag);


//------------------------------------Codec---------------------------------------------------------------------

app.post('/DVP/API/:version/Codec',jwt({secret: secret.Secret}), authorization({resource:"codec", action:"write"}), packageService.CreateCodec);
app.put('/DVP/API/:version/Codec/:codec',jwt({secret: secret.Secret}), authorization({resource:"codec", action:"write"}), packageService.UpdateCodec);
app.delete('/DVP/API/:version/Codec/:codec',jwt({secret: secret.Secret}), authorization({resource:"codec", action:"delete"}), packageService.DeleteCodec);
app.get('/DVP/API/:version/Codec/All',jwt({secret: secret.Secret}), authorization({resource:"codec", action:"read"}), packageService.GetAllCodec);
app.get('/DVP/API/:version/Codec/Active',jwt({secret: secret.Secret}), authorization({resource:"codec", action:"read"}), packageService.GetAllActiveCodec);
app.get('/DVP/API/:version/Codec/Active/:type',jwt({secret: secret.Secret}), authorization({resource:"codec", action:"read"}), packageService.GetCodecByType);


//-----------------------------------Tenant Monitoring----------------------------------------------------------

app.get('/DVP/API/:version/Tenant/Company/BasicInfo', jwt({secret: secret.Secret}), authorization({resource:"tenant", action:"read"}), tenantService.GetBasicCompanyDetailsByTenant);
app.get('/DVP/API/:version/Tenant/Company/:company', jwt({secret: secret.Secret}), authorization({resource:"tenant", action:"read"}), organisationService.GetOrganisation);

app.put('/DVP/API/:version/Organisation/:company', jwt({secret: secret.Secret}),authorization({resource:"tenant", action:"write"}), organisationService.UpdateOrganisation);
app.put('/DVP/API/:version/Organisation/:company/Package/:packageName', jwt({secret: secret.Secret}),authorization({resource:"tenant", action:"write"}), organisationService.AssignPackageToOrganisation);
app.put('/DVP/API/:version/Organisation/:company/Package/:packageName/Unit/:unitName/:topUpCount', jwt({secret: secret.Secret}),authorization({resource:"tenant", action:"write"}), organisationService.AssignPackageUnitToOrganisation);
app.put('/DVP/API/:version/Organisation/:company/Activate/:state', jwt({secret: secret.Secret}),authorization({resource:"tenant", action:"write"}), organisationService.ActivateOrganisation);

app.get('/DVP/API/:version/Tenant/Monitoring/superUsers', jwt({secret: secret.Secret}),authorization({resource:"tenant", action:"read"}), userService.GetSuperUsers);




//--------------------------------Active Directory Configuration-------------------------------------------------

app.post('/DVP/API/:version/ActiveDirectory',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"write"}), ActiveDirectory.CreateActiveDirectory);
app.put('/DVP/API/:version/ActiveDirectory/:adId',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"write"}), ActiveDirectory.UpdateActiveDirectory);
app.put('/DVP/API/:version/ActiveDirectory/:adId/ResetPassword',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"write"}), ActiveDirectory.ResetActiveDirectoryPassword);
app.delete('/DVP/API/:version/ActiveDirectory/:adId',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"delete"}), ActiveDirectory.RemoveActiveDirectory);
app.get('/DVP/API/:version/ActiveDirectory',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"read"}), ActiveDirectory.GetActiveDirectory);
app.get('/DVP/API/:version/ActiveDirectory/Group/Users',jwt({secret: secret.Secret}), authorization({resource:"organisation", action:"read"}), ActiveDirectory.GetUsersForGroup);

app.post('/DVP/API/:version/ActiveDirectory/FaceTone/User', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.CreateUserFromAD);



app.post('/DVP/API/:version/BusinessUnit', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), businessUnitService.AddBusinessUnit);
app.put('/DVP/API/:version/BusinessUnit/:unitname', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), businessUnitService.UpdateBusinessUnit);
app.put('/DVP/API/:version/BusinessUnit/:unitname/Groups', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), businessUnitService.UpdateBusinessUnitUserGroups);
app.get('/DVP/API/:version/BusinessUnits', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), businessUnitService.GetBusinessUnits);
app.get('/DVP/API/:version/BusinessUnitsWithGroups', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), businessUnitService.GetBusinessUnitsWithGroups);
app.get('/DVP/API/:version/BusinessUnit/:unitName', jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}), businessUnitService.GetBusinessUnit);

app.get('/DVP/API/:version/Supervisor/:sid/Groups', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"read"}), userGroupService.GetSupervisorUserGroups);
app.put('/DVP/API/:version/BusinessUnit/:name/Head/:hid', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"write"}), businessUnitService.AddHeadToBusinessUnits);
app.delete('/DVP/API/:version/BusinessUnit/:name/Head/:hid', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"write"}), businessUnitService.RemoveHeadToBusinessUnits);
app.put('/DVP/API/:version/BusinessUnit/:name/Heads', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"write"}), businessUnitService.AddHeadsToBusinessUnit);
app.get('/DVP/API/:version/Supervisor/:sid/BusinessUnits', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"read"}), businessUnitService.GetSupervisorBusinessUnits);
app.get('/DVP/API/:version/BusinessUnit/:name/Users', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"read"}), businessUnitService.GetUsersOfBusinessUnits);
app.get('/DVP/API/:version/MyBusinessUnit', jwt({secret: secret.Secret}),authorization({resource:"userGroup", action:"read"}), businessUnitService.GetMyBusinessUnit);


app.get('/DVP/API/:version/ExternalUserConfig', jwt({secret: secret.Secret}),authorization({resource:"externalUser", action:"write"}), externalUserService.GetAccessibleFieldConfig);
app.put('/DVP/API/:version/ExternalUserConfig', jwt({secret: secret.Secret}),authorization({resource:"externalUser", action:"write"}), externalUserService.UpdateAccessibleFieldConfig);
app.post('/DVP/API/:version/ExternalUserConfig', jwt({secret: secret.Secret}),authorization({resource:"externalUser", action:"write"}), externalUserService.AddAccessibleFieldConfig);
app.get('/DVP/API/:version/ExternalUserConfig/DefaultKeys', jwt({secret: secret.Secret}),authorization({resource:"externalUser", action:"write"}), externalUserService.GetDefaultAccessibleFieldConfig);
app.get('/DVP/API/:version/ExternalUserConfig/UserFields', jwt({secret: secret.Secret}),authorization({resource:"externalUser", action:"write"}), externalUserService.GetUserFields);






app.get('/DVP/API/:version/ReceivedInvitations',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.GetMyReceivedInvitations);
app.get('/DVP/API/:version/SendInvitations',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.GetMySendInvitations);
app.post('/DVP/API/:version/Invitation/to/:to',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),UserInvitationService.CreateInvitation);
app.get('/DVP/API/:version/Invitation/:id',jwt({secret: secret.Secret}),authorization({resource:"user", action:"read"}),UserInvitationService.GetInvitation);
app.put('/DVP/API/:version/Invitation/Accept/:id/company/:company/tenant/:tenant',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}),UserInvitationService.AcceptUserInvitation);
app.put('/DVP/API/:version/Invitation/Reject/:id/company/:company/tenant/:tenant',jwt({secret: secret.Secret}),authorization({resource:"myUserProfile", action:"write"}),UserInvitationService.RejectUserInvitation);
app.put('/DVP/API/:version/Invitation/Cancel/:id',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),UserInvitationService.CancelUserInvitation);
app.put('/DVP/API/:version/Invitation/Resend/:id',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),UserInvitationService.ResendUserInvitation);

app.put('/DVP/API/:version/UserAccount/:username/Activation/:state',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),userService.UserAcccountActivation);


app.post('/DVP/API/:version/UserAccount/DataMigrate/Domain',jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}),userService.UpdateUsersVeeryAccountDomain);


app.put('/DVP/API/:version/ReportUser/:username/Console/:consoleName/Navigation', jwt({secret: secret.Secret}),authorization({resource:"user", action:"write"}), userService.CreateReportUser);

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
