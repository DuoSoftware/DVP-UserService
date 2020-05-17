module.exports = {
  MONGO_URI:
    process.env.MONGO_URI || "mongodb://duo:DuoS123@45.55.142.207/dvpdb",
  TOKEN_SECRET: process.env.TOKEN_SECRET || "YOUR_UNIQUE_JWT_TOKEN_SECRET",

  // OAuth 2.0
  FACEBOOK_SECRET:
    process.env.FACEBOOK_SECRET || "a0acd201d949151b58f97768227c0e7d",
  FOURSQUARE_SECRET:
    process.env.FOURSQUARE_SECRET || "YOUR_FOURSQUARE_CLIENT_SECRET",
  GOOGLE_SECRET: process.env.GOOGLE_SECRET || "4po259JgUy9xJsCLkGj7Mj_m",
  //
  GITHUB_SECRET:
    process.env.GITHUB_SECRET || "ed7bbb48226294da88edad5f0df04914ce06e927",
  INSTAGRAM_SECRET:
    process.env.INSTAGRAM_SECRET || "YOUR_INSTAGRAM_CLIENT_SECRET",
  LINKEDIN_SECRET: process.env.LINKEDIN_SECRET || "YOUR_LINKEDIN_CLIENT_SECRET",
  TWITCH_SECRET: process.env.TWITCH_SECRET || "YOUR_TWITCH_CLIENT_SECRET",
  WINDOWS_LIVE_SECRET:
    process.env.WINDOWS_LIVE_SECRET || "YOUR_MICROSOFT_CLIENT_SECRET",
  YAHOO_SECRET: process.env.YAHOO_SECRET || "YOUR_YAHOO_CLIENT_SECRET",
  BITBUCKET_SECRET:
    process.env.BITBUCKET_SECRET || "YOUR_BITBUCKET_CLIENT_SECRET",
  SPOTIFY_SECRET: process.env.SPOTIFY_SECRET || "YOUR_SPOTIFY_CLIENT_SECRET",

  // OAuth 1.0
  TWITTER_KEY: process.env.TWITTER_KEY || "vdrg4sqxyTPSRdJHKu4UVVdeD",
  TWITTER_SECRET:
    process.env.TWITTER_SECRET ||
    "cUIobhRgRlXsFyObUMg3tBq56EgGSwabmcavQP4fncABvotRMA",

  auth: {
    // OAuth 2.0
    FACEBOOK_SECRET: "a0acd201d949151b58f97768227c0e7d",
    FOURSQUARE_SECRET: "YOUR_FOURSQUARE_CLIENT_SECRET",
    GOOGLE_SECRET: "4po259JgUy9xJsCLkGj7Mj_m",
    //
    GITHUB_SECRET: "ed7bbb48226294da88edad5f0df04914ce06e927",
    INSTAGRAM_SECRET: "YOUR_INSTAGRAM_CLIENT_SECRET",
    LINKEDIN_SECRET: "YOUR_LINKEDIN_CLIENT_SECRET",
    TWITCH_SECRET: "YOUR_TWITCH_CLIENT_SECRET",
    WINDOWS_LIVE_SECRET: "YOUR_MICROSOFT_CLIENT_SECRET",
    YAHOO_SECRET: "YOUR_YAHOO_CLIENT_SECRET",
    BITBUCKET_SECRET: "YOUR_BITBUCKET_CLIENT_SECRET",
    SPOTIFY_SECRET: "YOUR_SPOTIFY_CLIENT_SECRET",

    // OAuth 1.0
    TWITTER_KEY: "vdrg4sqxyTPSRdJHKu4UVVdeD",
    TWITTER_SECRET: "cUIobhRgRlXsFyObUMg3tBq56EgGSwabmcavQP4fncABvotRMA",

    login_verification: false,
    signup_verification: false,
    recaptcha_key: "6LezaAsUAAAAAFbtiyMzOlMmqEwzMwmMYszmO_Ve",

    ui_host: "http://localhost/DVP-AdminConsole",
    agent_host: "http://localhost/DVP-AgentConsole",
    common_signature: false,
    multi_login: true
  },

  DB: {
    Type: "postgres",
    User: "",
    Password: "",
    Port: 5432,
    Host: "",
    Database: ""
  },

  Redis: {
    mode: "instance", //instance, cluster, sentinel
    ip: "ec2-18-189-192-150.us-east-2.compute.amazonaws.com",
    port: 6379,
    user: "duo",
    password: "DuoS123",
    db: 0,
    sentinels: {
      hosts: "138.197.90.92,45.55.205.92,138.197.90.92",
      port: 16389,
      name: "redis-cluster"
    }
  },

  Security: {
    ip: "ec2-18-189-192-150.us-east-2.compute.amazonaws.com",
    port: 6379,
    user: "duo",
    password: "DuoS123",
    db: 0,
    mode: "instance", //instance, cluster, sentinel
    sentinels: {
      hosts: "138.197.90.92,45.55.205.92,138.197.90.92",
      port: 16389,
      name: "redis-cluster"
    }
  },

  Host: {
    profilesearch: "secondary",
    resource: "cluster",
    vdomain: "localhost",
    domain: "localhost",
    port: "3638",
    version: "1.0.0.0"
  },

  LBServer: {
    ip: "localhost",
    port: "3434"
  },

  RabbitMQ: {
    ip: "ec2-18-189-192-150.us-east-2.compute.amazonaws.com",
    port: 5672,
    user: "duo",
    password: "DuoS123",
    vhost: "/"
  },

  Mongo: {
    ip: "",
    port: "",
    dbname: "",
    password: "",
    user: "",
    type: "mongodb+srv",
  },

  Services: {
    accessToken:
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdWtpdGhhIiwianRpIjoiYWEzOGRmZWYtNDFhOC00MWUyLTgwMzktOTJjZTY0YjM4ZDFmIiwic3ViIjoiNTZhOWU3NTlmYjA3MTkwN2EwMDAwMDAxMjVkOWU4MGI1YzdjNGY5ODQ2NmY5MjExNzk2ZWJmNDMiLCJleHAiOjE5MDIzODExMTgsInRlbmFudCI6LTEsImNvbXBhbnkiOi0xLCJzY29wZSI6W3sicmVzb3VyY2UiOiJhbGwiLCJhY3Rpb25zIjoiYWxsIn1dLCJpYXQiOjE0NzAzODExMTh9.Gmlu00Uj66Fzts-w6qEwNUz46XYGzE8wHUhAJOFtiRo",
    resourceServiceHost: "resourceservice.app.veery.cloud",
    resourceServicePort: "8831",
    resourceServiceVersion: "1.0.0.0",
    sipuserendpointserviceHost: "sipuserendpointservice.app.veery.cloud",
    sipuserendpointservicePort: "8086",
    sipuserendpointserviceVersion: "1.0.0.0",
    ruleserviceHost: "ruleservice.app1.veery.cloud",
    ruleservicePort: "8816",
    ruleserviceVersion: "1.0.0.0",
    fileserviceHost: "fileservice.app1.veery.cloud",
    fileservicePort: "5648",
    fileserviceVersion: "1.0.0.0",
    liteticketHost: "liteticket.app1.veery.cloud",
    liteticketPort: "3635",
    liteticketVersion: "1.0.0.0",
    clusterconfigserviceHost: "clusterconfig.app1.veery.cloud",
    clusterconfigservicePort: "3636",
    clusterconfigserviceVersion: "1.0.0.0",
    billingserviceHost: "billingservice.app.veery.cloud",
    billingservicePort: "4444",
    billingserviceVersion: "1.0.0.0",
    notificationServiceHost: "notificationservice.app1.veery.cloud",
    notificationServicePort: "8089",
    notificationServiceVersion: "1.0.0.0",
    dynamicPort : false
  },

  Tenant: {
    activeTenant: 1,
    activeCompany: 0
  },

  ClusterName: "DemoCloud",
  Provision: 1,

  ActiveDirectory: {
    groupName: "FaceTone"
  }
};
