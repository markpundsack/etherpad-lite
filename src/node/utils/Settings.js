/**
 * The Settings Modul reads the settings out of settings.json and provides 
 * this information to the other modules
 */

/*
 * 2011 Peter 'Pita' Martischka (Primary Technology Ltd)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require("fs");
var os = require("os");
var path = require('path');
var argv = require('./Cli').argv;
var npm = require("npm/lib/npm.js");
var vm = require('vm');
var log4js = require("log4js");
var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var url = require("url");


/* Root path of the installation */
exports.root = path.normalize(path.join(npm.dir, ".."));

/**
 * The app title, visible e.g. in the browser window
 */
exports.title = process.env.TITLE || "Etherpad";

/**
 * The app favicon fully specified url, visible e.g. in the browser window
 */
exports.favicon = "favicon.ico";
exports.faviconPad = "../" + exports.favicon;
exports.faviconTimeslider = "../../" + exports.favicon;

/**
 * The IP ep-lite should listen to
 */
exports.ip = "0.0.0.0";
  
/**
 * The Port ep-lite should listen to
 */
exports.port = process.env.PORT || 9001;

/**
 * The SSL signed server key and the Certificate Authority's own certificate
 * default case: ep-lite does *not* use SSL. A signed server key is not required in this case.
 */
exports.ssl = process.env.SSL || false;

/**
 * socket.io transport methods
 **/
exports.socketTransportProtocols = ['xhr-polling', 'jsonp-polling', 'htmlfile'];

/*
 * The Type of the database
 * And the settings passed with dbType to ueberDB to set up the database
 */
if (process.env.DATABASE_URL) {
  var database_url = url.parse(process.env.DATABASE_URL);
  var auth = database_url.auth.split(":");
  exports.dbType = database_url.protocol;
  exports.dbSettings = {  "user" : auth[0],
                          "password" : auth[1],
                          "host" : database_url.hostname,
                          "database" : database_url.pathname};
} else {
  exports.dbType = "dirty";
  exports.dbSettings = { "filename" : "var/dirty.db" };
}


/**
 * The default Text of a new pad
 */
exports.defaultPadText = process.env.DEFAULTPADTEXT || "Welcome to Etherpad!\n\nThis pad text is synchronized as you type, so that everyone viewing this page sees the same text. This allows you to collaborate seamlessly on documents!\n\nEtherpad on Github: http:\/\/j.mp/ep-lite\n";

/**
 * A flag that requires any user to have a valid session (via the api) before accessing a pad
 */
exports.requireSession = process.env.REQUIRESESSION || false;

/**
 * A flag that prevents users from creating new pads
 */
exports.editOnly = process.env.EDITONLY || false;

/**
 * Max age that responses will have (affects caching layer).
 */
exports.maxAge = process.env.MAXAGE || 1000*60*60*6; // 6 hours

/**
 * A flag that shows if minification is enabled or not
 */
exports.minify = process.env.MINIFY || true;

/**
 * The path of the abiword executable
 */
exports.abiword = null;

/**
 * The log level of log4js
 */
exports.loglevel = process.env.LOGLEVEL || "INFO";

/*
* log4js appender configuration
*/
exports.logconfig = { appenders: [{ type: "console" }]};

/*
* Session Key, do not sure this.
*/
exports.sessionKey = process.env.SESSIONKEY || false;

/*
* Trust Proxy, whether or not trust the x-forwarded-for header.
*/
exports.trustProxy = process.env.TRUSTPROXY || false;

/* This setting is used if you need authentication and/or
 * authorization. Note: /admin always requires authentication, and
 * either authorization by a module, or a user with is_admin set */
exports.requireAuthentication = process.env.REQUIREAUTHENTICATION || false;
exports.requireAuthorization = process.env.REQUIREAUTHORIZATION || false;
exports.users = (process.env.USERS)?JSON.parse(process.env.USERS):{};

//checks if abiword is avaiable
exports.abiwordAvailable = function()
{
  if(exports.abiword != null)
  {
    return os.type().indexOf("Windows") != -1 ? "withoutPDF" : "yes";
  }
  else
  {
    return "no";
  }
};

exports.reloadSettings = function reloadSettings() {
  // Discover where the settings file lives
  var settingsFilename = argv.settings || "settings.json";
  settingsFilename = path.resolve(path.join(exports.root, settingsFilename));

  var settingsStr;
  try{
    //read the settings sync
    settingsStr = fs.readFileSync(settingsFilename).toString();
  } catch(e){
    console.warn('No settings file found. Continuing using defaults and/or environment!');
  }

  // try to parse the settings
  var settings;
  try {
    if(settingsStr) {
      settings = vm.runInContext('exports = '+settingsStr, vm.createContext(), "settings.json");
      settings = JSON.parse(JSON.stringify(settings)); // fix objects having constructors of other vm.context
    }
  }catch(e){
    console.error('There was an error processing your settings.json file: '+e.message);
    process.exit(1);
  }

  //loop trough the settings
  for(var i in settings)
  {
    //test if the setting start with a low character
    if(i.charAt(0).search("[a-z]") !== 0)
    {
      console.warn("Settings should start with a low character: '" + i + "'");
    }

    //we know this setting, so we overwrite it
    //or it's a settings hash, specific to a plugin
    if(exports[i] !== undefined || i.indexOf('ep_')==0)
    {
      exports[i] = settings[i];
    }
    //this setting is unkown, output a warning and throw it away
    else
    {
      console.warn("Unknown Setting: '" + i + "'. This setting doesn't exist or it was removed");
    }
  }
  
  log4js.configure(exports.logconfig);//Configure the logging appenders
  log4js.setGlobalLogLevel(exports.loglevel);//set loglevel
  log4js.replaceConsole();

  if(!exports.sessionKey){ // If the secretKey isn't set we also create yet another unique value here
    exports.sessionKey = randomString(32);
    console.warn("You need to set a sessionKey value in settings.json, this will allow your users to reconnect to your Etherpad Instance if your instance restarts");
  }

  if(exports.dbType === "dirty"){
    console.warn("DirtyDB is used. This is fine for testing but not recommended for production.");
  }
};

// initially load settings
exports.reloadSettings();
