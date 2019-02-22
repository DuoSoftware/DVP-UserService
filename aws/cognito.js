const config = require('config'),
  bcrypt = require('bcryptjs'),
  User = require('dvp-mongomodels/model/User'),
  orgService = require('../OrganisationService'),
  AWSAuth = require('./aws-auth');

const 
  SIGNUP_PAYLOAD_RULES = {
    "mail": {"type": "string", required: true},
    "password": {"type": "string", required: true},
    "companyname":{"type": "string", required: true}},
  SIGNIN_PAYLOAD_RULES = {
    "userName": {"type": "string", required: true},
    "password": {"type": "string", required: true}};
  CHANGEPASSWORD_PAYLOAD_RULES = {
    "userName": {"type": "string", required: true},
    "oldPassword": {"type": "string", required: true},
    "newPassword": {"type": "string", required: true}},
  FORGOTPASSWORD_PAYLOAD_RULES = {
    "userName": {"type": "string", required: true}},
  CONFIRMPASSWORD_PAYLOAD_RULES = {
    "userName": {"type": "string", required: true},
    "verificationCode": {"type": "string", required: true},
    "newPassword": {"type": "string", required: true}},
  INVITEUSER_PAYLOAD_RULES = {
    "userName": {"type": "string", required: true}
  };

const signUp = (req, res, next) => {
  let rpReport = validateRequestPayload(req.body, SIGNUP_PAYLOAD_RULES);

  if (rpReport.status === 'failed') {
    return res.status(400).send({message: " Invalid request payload.", errors: rpReport.violatedRules});
  }

  let payload = req.body;
    payload.timeZone = payload.timeZone || "";
  let user = {
    username: payload.mail,
    password: payload.password,
    attributes: {
      'name': payload.mail,
      'custom:company_name': payload.companyname
    },
  };

  AWSAuth.signUp(user)
    .then((awsUser) => createFacetoneUser(user))
    .then((user) => createOrganisation(user, payload.companyname, payload.timeZone))
    .then((org) => createMetaData(org, AWSAuth.getAWSAuthInfo()))
    .then((data) => res.send({state: "new", message: "Registration successfull!", companyId: data.company}))
    .catch(err => { 
      res.status(401).send({message:err.message})
    });
}

const signIn = (req, res, next) => {
  let rpReport = validateRequestPayload(req.body, SIGNIN_PAYLOAD_RULES);

  if (rpReport.status === 'failed') {
    return res.status(400).send({message: "Invalid request payload.", errors: rpReport.violatedRules});
  }

  let payload = req.body;

  AWSAuth.signIn(payload.userName, payload.password).then((result) => {
    let session = result,
      userSession = session.getIdToken().decodePayload();

    _exchangeToken(session.getIdToken().getJwtToken(), userSession['custom:company_name']).then(console.log).catch(console.log)
  }).catch(err => {console.log('catch-block', err)});
}

const forgotPassword = (req, res, next) => {
  console.log('aws forgot password internal method.');

  let rpReport = validateRequestPayload(req.body, FORGOTPASSWORD_PAYLOAD_RULES);

  if (rpReport.status === 'failed') {
    console.log('Invalid request payload', rpReport.violatedRules);
    return res.status(400).send({message: "Invalid request payload.", errors: rpReport.violatedRules});
  }

  let payload = req.body;

  AWSAuth.forgotPassword(payload.userName)
    .then((response) => {
      if (response.DeliveryMedium === "EMAIL") {
        res.send({state: "new", message: `A verification code has been sent to your email address: ${response.Destination}`})
      }
    })
    .catch((err) => {
      return res.status(404).send({message: `${err.message}`});
    });
}

const changePassword = (req, res, next) => {
  let rpReport = validateRequestPayload(req.body, CHANGEPASSWORD_PAYLOAD_RULES);

  if (rpReport.status === 'failed') {
    return res.status(400).send({message: "Invalid request payload.", errors: rpReport.violatedRules});
  }

  let payload = req.body;

  AWSAuth.changePassword(payload.userName, payload.oldPassword, payload.newPassword)
    .then((result) => {
      console.log(result);
    })
    .catch((err) => {
      console.log(err);
    })
}

const confirmPassword = (req, res, next) => {
  console.log('aws confirm password internal method.');

  let rpReport = validateRequestPayload(req.body, CONFIRMPASSWORD_PAYLOAD_RULES);

  if (rpReport.status === 'failed') {
    console.log('Invalid request payload', rpReport.violatedRules);
    return res.status(400).send({message: "Invalid request payload.", errors: rpReport.violatedRules});
  }

  let payload = req.body;

  AWSAuth.confirmPassword(payload.userName, payload.verificationCode, payload.newPassword)
    .then(() => resetFacetoneUserPassword(payload.userName, payload.newPassword))
    .then(() => {
      res.send({ message: "Successfully reset the password."});
    })
    .catch((err) => {
      res.status(401).send({message:err.message});
    });
}

const inviteUser = (req, res, next) => {
  console.log('aws invite user internal method.');

  let rpReport = validateRequestPayload(req.body, INVITEUSER_PAYLOAD_RULES);

  if (rpReport.status === 'failed') {
    console.log('Invalid request payload', rpReport.violatedRules);
    return res.status(400).send({message: "Invalid request payload.", errors: rpReport.violatedRules});
  }

  let payload = req.body;
  payload['companyName'] = req.user.companyName;

  AWSAuth.inviteUser(payload)
  .then((result) => {
    res.send({message: `A invitaion has been sent to email address: ${payload.userName}`})
  })
  .catch((err) => {
    return res.status(404).send({message: `${err.message}`});
  })

}

const listInvitedUsers = (req, res, next) => {
  console.log('aws get invited users internal method.');

  AWSAuth.listUsers()
  .then((result) => {
    res.send({data: result})
  })
  .catch((err) => {
    return res.status(404).send({message: `${err.message}`});
  });

}

const validateRequestPayload = (payload, payloadRules) => {
  let violatedRules = [];

  for (const key in payloadRules) {
    if (payload[key] === undefined && payloadRules[key].required) {
      violatedRules.push(`Missing required field ${key}.`);
    } else if (payload[key] && typeof payload[key] !== payloadRules[key].type) {
      violatedRules.push(`Invalid value type for ${key} field.`);        
    }
  }

  return {
    status: (violatedRules.length)? 'failed': 'passed',
    violatedRules 
  };
}

const createFacetoneUser = (user) => {
  if (!user || !user.username || !user.password) { Promise.reject(new Error('Invalid params given for create user.')); }

  const _user = new User({
    displayName: user.attributes.name || "",
    email: {
      contact: user.username,
      type: "email",
      display: user.username,
      verified: false
    },
    username: user.username,
    password: user.password,
    systemuser: true,
    Active: true,
    company: 0,
    tenant: 1,
    created_at: Date.now(),
    updated_at: Date.now()
  });

  return new Promise((resolve, reject) => {
    _user.save((err, result) => {
      if (err || !result) {
        reject(err || new Error('Error getting while creating a user.'));
      }else {
        resolve(_user); 
      }
    });
  });

}

const createOrganisation = (user, companyName, timezone) => {
  if (!user || !companyName) { Promise.reject('Invalid params given for create organization.'); }

  timezone = timezone || '';

  return new Promise((resolve, reject) => {
    orgService.CreateOrganisationStanAlone(user, companyName, timezone, (err, result) => {
      if (err || !result) {
        reject(err || new Error('Error getting while creating a organization.'));
      } else {
        resolve(Object.assign(result, {companyName}));
      } 
    });
  });
}

const createMetaData = async (org, auth) => {
  let _meta = {
    "tenant": org.tenant,
    "company": org.company,
    "config": {},
    "authType": "",
    "displayName": org.companyName,
    "imageUrl": "https://s3.amazonaws.com/botmediastorage/icon-stories-circle.png",
  }

  if (auth.authClient === 'cognito') {
    _meta['authType'] = auth.authClient;
    _meta['config']['cognito'] = {
      poolRegion: auth.region,
      userPoolId: auth.userPoolId
    }
  }

  try {
    const url = `https://${config.Services.authgeneratorserviceHost}/DBF/API/${config.Services.authgeneratorserviceVersion}/metadata`
    let rawMeta = await fetch(url, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(_meta) 
    });

    meta = await rawMeta.json();

    if (meta.IsSuccess) { return meta.Result; }
    else {throw new Error(meta.CustomMessage || "Error getting while creating meta data." )}
  } catch (err) {
    throw err;
  }
}

const _exchangeToken = async (token, companyName) => {
  if (!token || !companyName) { Promise.reject('Invalid params given for exchange Token.'); }

  const _exchangePayload = {
    "scope": ["all_all", "profile_veeryaccount"],
    "console": "BOT_CONSOLE",
    "clientID": "YWU4NDkyNDAtMmM2ZC0xMWU2LWIyNzQtYTllZWM3ZGFiMjZiOjYxNDU4MTMxMDIxNDQyNTgwNDg=",
    "companyName" : companyName
  }

  try {
    const url = `https://${config.Services.authgeneratorserviceHost}/DBF/API/${config.Services.authgeneratorserviceVersion}/auth`
    let rawExchangedData = await fetch(url, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'federated_token' : token
      },
      body: JSON.stringify(_exchangePayload) 
    });

    _exchangedData = await rawExchangedData.json();
    console.log(_exchangedData);
    // if (meta.IsSuccess) { return meta.Result; }
    // else {throw new Error(meta.CustomMessage || "Error getting while creating meta data." )}
  } catch (err) {
    throw err;
  }
}

const resetFacetoneUserPassword = (username, password) => {
  console.log('facetone password reset internal method');

  return new Promise((resolve, reject) => {
    bcrypt.genSalt(10, function(err, salt) {
      bcrypt.hash(password, salt, function(err, hash) {
        if(err) { reject(new Error('Error getting while encripting the password.')); }
        else {
          User.findOneAndUpdate({"username": username}, {password: hash}, function (err, existingUser) {
            if (!existingUser || err) { 
              /* User not exists */ 
              console.log('User not exists on facetone.');
              reject(new Error('User not exists on facetone'));
            }
            else {
              console.log('successfully reset the password');
              resolve('successfully reset the password')
            }
          });
        }
      });
    });
  });
}

module.exports = {
  signUp,
  signIn,
  changePassword,
  forgotPassword,
  inviteUser,
  listInvitedUsers,
  confirmPassword
}