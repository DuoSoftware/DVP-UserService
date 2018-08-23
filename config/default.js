module.exports = {


  MONGO_URI: process.env.MONGO_URI || '',
  TOKEN_SECRET: process.env.TOKEN_SECRET || 'YOUR_UNIQUE_JWT_TOKEN_SECRET',

  // OAuth 2.0
  FACEBOOK_SECRET: process.env.FACEBOOK_SECRET || '',
  FOURSQUARE_SECRET: process.env.FOURSQUARE_SECRET || 'YOUR_FOURSQUARE_CLIENT_SECRET',
  GOOGLE_SECRET: process.env.GOOGLE_SECRET || '',
  //
  GITHUB_SECRET: process.env.GITHUB_SECRET || '',
  INSTAGRAM_SECRET: process.env.INSTAGRAM_SECRET || 'YOUR_INSTAGRAM_CLIENT_SECRET',
  LINKEDIN_SECRET: process.env.LINKEDIN_SECRET || 'YOUR_LINKEDIN_CLIENT_SECRET',
  TWITCH_SECRET: process.env.TWITCH_SECRET || 'YOUR_TWITCH_CLIENT_SECRET',
  WINDOWS_LIVE_SECRET: process.env.WINDOWS_LIVE_SECRET || 'YOUR_MICROSOFT_CLIENT_SECRET',
  YAHOO_SECRET: process.env.YAHOO_SECRET || 'YOUR_YAHOO_CLIENT_SECRET',
  BITBUCKET_SECRET: process.env.BITBUCKET_SECRET || 'YOUR_BITBUCKET_CLIENT_SECRET',
  SPOTIFY_SECRET: process.env.SPOTIFY_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET',

  // OAuth 1.0
  TWITTER_KEY: process.env.TWITTER_KEY || '',
  TWITTER_SECRET: process.env.TWITTER_SECRET || '',


  "auth": {

      // OAuth 2.0
      FACEBOOK_SECRET: '',
      FOURSQUARE_SECRET: 'YOUR_FOURSQUARE_CLIENT_SECRET',
      GOOGLE_SECRET: '',
      //
      GITHUB_SECRET: '',
      INSTAGRAM_SECRET: 'YOUR_INSTAGRAM_CLIENT_SECRET',
      LINKEDIN_SECRET: 'YOUR_LINKEDIN_CLIENT_SECRET',
      TWITCH_SECRET: 'YOUR_TWITCH_CLIENT_SECRET',
      WINDOWS_LIVE_SECRET: 'YOUR_MICROSOFT_CLIENT_SECRET',
      YAHOO_SECRET: 'YOUR_YAHOO_CLIENT_SECRET',
      BITBUCKET_SECRET: 'YOUR_BITBUCKET_CLIENT_SECRET',
      SPOTIFY_SECRET: 'YOUR_SPOTIFY_CLIENT_SECRET',

      // OAuth 1.0
      TWITTER_KEY: '',
      TWITTER_SECRET: '',

      login_verification: false,
      signup_verification: true,
      recaptcha_key: "6LezaAsUAAAAAFbtiyMzOlMmqEwzMwmMYszmO_Ve",

      ui_host: 'http://localhost:3000/',
      agent_host: 'http://localhost:3000/',
      common_signature: false,
      multi_login: false


  },

    "DB": {
        "Type":"postgres",
        "User":"",
        "Password":"",
        "Port":5432,
        "Host":"",
        "Database":""
    },


  "Redis":
  {
    "mode":"instance",//instance, cluster, sentinel
    "ip": "",
    "port": 6389,
    "user": "",
    "password": "",
    "sentinels":{
      "hosts": "",
      "port":16389,
      "name":"redis-cluster"
    }

  },


  "Security":
  {

    "ip" : "",
    "port": 6389,
    "user": "",
    "password": "",
    "mode":"instance",//instance, cluster, sentinel
    "sentinels":{
      "hosts": "",
      "port":16389,
      "name":"redis-cluster"
    }
  },

  "Host":
  {
    "profilesearch":"secondary",
    "resource": "cluster",
    "vdomain": "localhost",
    "domain": "localhost",
    "port": "3638",
    "version": "1.0.0.0"
  },

  "LBServer" : {

    "ip": "localhost",
    "port": "3434"

  },

  "RabbitMQ":
  {
    "ip": "",
    "port": 5672,
    "user": "",
    "password": "",
    "vhost":'/'
  },


  "Mongo":
  {
    "ip":"",
    "port":"27017",
    "dbname":"",
    "password":"",
    "user":"",
    "replicaset" :""
  },

  "Services" : {
    "accessToken":"",
    "resourceServiceHost": "",
    "resourceServicePort": "8831",
    "resourceServiceVersion": "1.0.0.0",
    "sipuserendpointserviceHost": "127.0.0.1",
    "sipuserendpointservicePort": "8086",
    "sipuserendpointserviceVersion": "1.0.0.0",
    "ruleserviceHost": "127.0.0.1",
    "ruleservicePort": "8816",
    "ruleserviceVersion": "1.0.0.0",
    "fileserviceHost": "127.0.0.1",
    "fileservicePort": "5648",
    "fileserviceVersion": "1.0.0.0",
    "liteticketHost": "127.0.0.1",
    "liteticketPort": "3635",
    "liteticketVersion": "1.0.0.0",
    "clusterconfigserviceHost": "127.0.0.1",
    "clusterconfigservicePort": "3636",
    "clusterconfigserviceVersion": "1.0.0.0",
    "billingserviceHost": "",
    "billingservicePort": "4444",
    "billingserviceVersion": "1.0.0.0",
    "notificationServiceHost": "",
    "notificationServicePort": "8089",
    "notificationServiceVersion": "1.0.0.0"
  },

  "Tenant": {
    "activeTenant": 1,
    "activeCompany": 0
  },

  "ClusterName": "DemoCloud",
  "Provision": 1,

  "ActiveDirectory": {
    "groupName": "FaceTone"
  }



};
