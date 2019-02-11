global.fetch = require('node-fetch');

const config = require('config'),
  { CognitoUserPool, 
    CognitoUser, 
    CognitoUserAttribute, 
    AuthenticationDetails 
  } = require('amazon-cognito-identity-js');

const userPool = new CognitoUserPool({
  UserPoolId: config.AWS.Auth.userPoolId,
  ClientId: config.AWS.Auth.userPoolWebClientId
});

const tranformToCognitoUserAttributes = (attrs) => {
  let _attrs = attrs || {},
    _cognitoAttrList = [];
  
  for (const key in _attrs) { 
    _cognitoAttrList.push(new CognitoUserAttribute({ Name: key, Value: _attrs[key] }));
  }

  return _cognitoAttrList;
}

const signUp = (user) => {
  if (user) {
    let cognitoUserAttributes = tranformToCognitoUserAttributes(user.attributes);

    return new Promise((resolve, reject) => {
      userPool.signUp(user.username, user.password, cognitoUserAttributes, user.validations, (err, result) => {
        if (err) { 
          console.error(err);
          reject(err);
        }
        resolve(result.user);
      });
    }); 
  }
}

const signIn = (username, password) => {
  let authenticationDetails = new AuthenticationDetails({ Username: username, Password: password });
  let cognitoUser = new CognitoUser({ Username : username, Pool : userPool });

  cognitoUser.setAuthenticationFlowType(config.AWS.Auth.authenticationFlowType);

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (result) {
        resolve(result);
      },
      onFailure: function (error) {
        reject(error);
      }
    })
  });
}

const changePassword = (username, oldPassword, newPassword) => {
  let cognitoUser = new CognitoUser({ Username : username, Pool : userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve(result);
    });
  });
}

const forgotPassword = (username) => {
  let cognitoUser = new CognitoUser({ Username : username, Pool : userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: function(data) { 
        console.log('CodeDeliveryData from forgotPassword: ' + JSON.stringify(data));
        resolve(data.CodeDeliveryDetails);
      },
      onFailure: function(err) { 
        console.log(err.message || JSON.stringify(err));
        reject(err);
      }
    });
  });
}

const confirmPassword = (username, verificationCode, newPassword) => {
  let cognitoUser = new CognitoUser({ Username : username, Pool : userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess() {
        console.log('Password confirmed!');
        resolve('Password confirmed!');
      },
      onFailure(err) {
        console.log('Password not confirmed!', err);
        reject(err);
      }
    });
  })

}

const removeUser = (username) => {
  let cognitoUser = new CognitoUser({ Username : username, Pool : userPool });

  return new Promise((resolve, reject) => {
    cognitoUser.deleteUser(username, (err, result) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve(result);
    });
  });
}

const getAWSAuthInfo = () => {
  return {
    userPoolId: userPool.getUserPoolId(),
    clientId: userPool.getClientId(),
    region: config.AWS.Auth.region,
    authClient: 'cognito'
  };
}

module.exports = {
  signUp,
  signIn,
  changePassword,
  forgotPassword,
  confirmPassword,
  removeUser,
  getAWSAuthInfo
}