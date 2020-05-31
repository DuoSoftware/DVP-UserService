/**
 * Created by a on 6/7/2016.
 */

var logger = require('dvp-common-lite/LogHandler/CommonLogHandler.js').logger;
var Client = require('dvp-mongomodels/model/Client');
var messageFormatter = require('dvp-common-lite/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var FlakeIdGen = require('flake-idgen')
var intformat = require('biguint-format')
var uuid = require('node-uuid');


var generator = new FlakeIdGen;



function GetClients(req, res){


    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    Client.find({}, function(err, clients) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Clients Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Get Clients Successful", true, clients);

        }

        res.end(jsonString);
    });

}

function GetClient(req, res){


    logger.debug("DVP-UserService.GetUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    Client.findOne({clientId: req.params.clientid}, function(err, client) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Client Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Get Client Successful", true, client);

        }

        res.end(jsonString);
    });








}

function DeleteClient(req,res){


    logger.debug("DVP-UserService.DeleteUsers Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    Client.findOneAndRemove({clientId: req.params.clientid}, function(err, user) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get User Failed", false, undefined);


        }else{
            jsonString = messageFormatter.FormatMessage(undefined, "User successfully deleted", true, undefined);
        }

        res.end(jsonString);


    });

}

function CreateClient(req, res){

    logger.debug("DVP-UserService.CreateUser Internal method ");

    var uuid1 = uuid.v1();
    var id1 = generator.next();
    var id3 = intformat(id1, 'dec');


    var client = Client({


        name: req.body.name,
        clientId: uuid1,
        clientSecret: id3,
        redirectURL: req.body.url,
        owner: req.user.iss


    });






    var jsonString = messageFormatter.FormatMessage(undefined, "Client saved successfully", true, client);
    client.save(function(err, client) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "User Client failed", false, undefined);


        }

        res.end(jsonString);

    });




}




function AddClientClaim(req, res){



    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //Show.update({ "_id": showId },{ "$push": { "episodes": episodeData } },callback)
    Client.findOneAndUpdate({clientId: req.params.id},{ "$push": { "claims": req.body } }, function(err, client) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Update client claims Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Update client claims successfully", false, client);

        }

        res.end(jsonString);


    });




}

function RemoveClientClaim(req, res){

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;

    //{ $pullAll : { 'comments' : [{'approved' : 1}, {'approved' : 0}] } });
    Client.findOneAndUpdate({clientId: req.params.id},{ "$pullAll": { "claims": [{"scope":req.params.claim}] } }, function(err, client) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Remove client claims Failed", false, undefined);


        }else{

            jsonString = messageFormatter.FormatMessage(undefined, "Remove client claims successfully", false, client);

        }

        res.end(jsonString);


    });

}

function GetClientClaims(req, res){


    logger.debug("DVP-UserService.GetClientClaims Internal method ");

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var jsonString;
    Client.findOne({clientId: req.params.id}, function(err, users) {
        if (err) {

            jsonString = messageFormatter.FormatMessage(err, "Get Client claims Failed", false, undefined);

        }else{

            jsonString = messageFormatter.FormatMessage(err, "Get Client claims Successful", true, client.claims);

        }

        res.end(jsonString);
    });








}







module.exports.GetClients = GetClients;
module.exports.GetClient = GetClient;
module.exports.DeleteClient= DeleteClient;
module.exports.CreateClient = CreateClient;
module.exports.AddClientClaim = AddClientClaim;
module.exports.RemoveClientClaim = RemoveClientClaim;
module.exports.GetClientClaims = GetClientClaims;

