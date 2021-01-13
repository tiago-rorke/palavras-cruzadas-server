"use strict";

// we're starting!
console.log("welcome to palavras cruzadas");

// to have a server:
const express = require("express");
// to have sockets:
const socketIO = require("socket.io");
// to read and write files and folders:
const fs = require("fs");
// to simplify diacritics:
const latinize = require("latinize");

// to simplify diacritics:
const Crossword = require("./js/crossword");
const e = require("express");

// AWS S3 for file storage
const aws = require('aws-sdk');

// create the crossword object, game size is set in initialize()
let crossword = new Crossword(0,0);

// testing latinize
console.log(latinize("ỆᶍǍᶆṔƚÉ áéíóúýčďěňřšťžů")); // => 'ExAmPlE aeiouycdenrstzu');

// port comes from ENV - or else it's 3000:
const PORT = process.env.PORT || 3000;

// we create the APP:
var app = express();

// we need some folders for static files:
app.use("/", express.static(__dirname + "/"));
app.use("/css", express.static(__dirname + "/css"));
app.use("/js", express.static(__dirname + "/js"));

// first page to be served is:
const INDEX = "./index.html";

// we answer to requests with our index::
app.use((req, res) => res.sendFile(INDEX, { root: __dirname }));

// we create the server object:
const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// the socket gets the server object:
const io = socketIO(server);

// files we are using
const game_folder = "old_games/"; // not used currently, archiving games in root folder to simplify s3 sync
const game_file = "game.json";
const config_file = "config.json"

// for storing vars from config file
let config;

// game state flag
let game_active;

// for counting players
let player_number = 0, max_player_number = 0;


// ---------------------- AWS S3 for file storage ------------------ //

const s3 = new aws.S3({
  accessKeyId: process.env.AWSAccessKeyId,
  secretAccessKey: process.env.AWSSecretKey,
  Bucket: process.env.S3_BUCKET_NAME
});
const aws_bucket = "palavras-cruzadas-server"

async function s3Download(file) {
  return new Promise((resolve, reject) => {
    s3.createBucket({Bucket: aws_bucket}, () => {
      s3.getObject({Bucket: aws_bucket, Key: file}, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  });
}

async function s3Upload(file, contents) {
  return new Promise((resolve, reject) => {
    s3.createBucket({Bucket: aws_bucket}, () => {
      s3.putObject({Bucket: aws_bucket, Key: file, Body: contents}, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  });
}

async function s3SyncFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", async (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // if file doesn't exist, get it from the bucket
          console.log(file, "not found, getting from S3 bucket...");
          let s3_data = await s3Download(file);
          await fs.writeFile(file, s3_data.Body, (err) => {
              if (err) {
                return console.log(err);
              } else {
                console.error("done");
                resolve(true);
              }
            }
          );
        } else {
          console.error(err);
          reject(err);
          //throw err;
        }
      } else {
        // otherwise, upload it to the bucket
        console.log("uploading " + file + " to S3 bucket...");
        await s3Upload(file, data);
        console.error("done");
        resolve(true);
      }
    });
  });
}

async function s3test() {
  let updata = await s3Upload("test.txt", "hello s3");
  console.log(updata);
  let data = await s3Download("config.json");
  let data_p = JSON.parse(data.Body);
  console.log(data_p);
}
//s3test();


// -------------------------- TIMESTAMPS --------------------------- //

// a function to print pretty time:
function pretty_date() {
  let d = new Date();
  let datestring =
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2) +
    " " +
    ("0" + d.getHours()).slice(-2) +
    ":" +
    ("0" + d.getMinutes()).slice(-2) +
    ":" +
    ("0" + d.getSeconds()).slice(-2) +
    ":" +
    d.getUTCMilliseconds();
  return datestring;
}

// a function to print pretty computerized time:
function pretty_computer_date() {
  let d = new Date();
  let datestring =
    d.getFullYear() +
    "" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "" +
    ("0" + d.getDate()).slice(-2) +
    "_" +
    ("0" + d.getHours()).slice(-2) +
    "" +
    ("0" + d.getMinutes()).slice(-2) +
    "" +
    ("0" + d.getSeconds()).slice(-2) +
    "_" +
    d.getUTCMilliseconds();
  return datestring;
}

// ---------------------------- CONFIG ----------------------------- //

function loadConfig(){
  try {
    //let s3_config = await s3Download(config_file);
    //return JSON.parse(s3_config.Body);
    return JSON.parse(fs.readFileSync(config_file, 'utf8'));
  } catch (err) {
    return console.log(err);
  }
}

function saveConfig() {
  fs.writeFile(config_file, JSON.stringify(config, null, 1), (err) => {
      if (err) return console.log(err);
    });
  return true;
}


// ----------------------------- INIT ------------------------------ //


// a function onStart:
async function initialize(new_game) {

  // flag the game as active
  game_active = false;

  // we start with 0 players
  player_number = 0;

  // we start with 0 players
  max_player_number = 0;

  // if we want to reload an existing game
  if (!new_game) {
    console.log("restoring game...");
    // read json and fill our arrays:
    await fs.readFile(game_file, "utf8", (err, data_from_json) => {
    // await s3Download(game_file)
    // .then(data_from_json) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // if no json file, start a new game
          console.log('no game file found, starting a new game');
          newGame();
          console.log("new game has started!");
        } else {
          console.error(err);
          throw err;
        }
      }
      crossword.load(data_from_json, true);
    });
    // and mark game as active:
    game_active = true;
  }
  // if we want to start a new game, backup the old one and start anew:
  else {
    console.log("starting a new game...");
    ///let game_archived = game_folder + pretty_computer_date() + ".json";
    let game_archived = pretty_computer_date() + ".json";
    // reload the config file, in case we have defined a new game size
    await fs.rename(
      game_file,
      game_archived,
      function (err) {
        if (err) {
          throw err;
        } else {
          s3SyncFile(game_archived);
          console.log("current game has been archived!");
          newGame();
          console.log("new game has started!");
        }
      }
    );
  }
}

// -------------------------- GAME STATE --------------------------- //

function newGame() {

  crossword.start_time = pretty_date();
  console.log(crossword.start_time);
  // create a new game, initing crossword part:
  crossword.init(config.game.width, config.game.height);
  // start a new json:
  crossword.save(game_file);
  s3SyncFile(game_file);
  // and mark game as active:
  game_active = true;
  // let the clients know so they can initialise the game grid
  io.emit("server", { message: "newGame" });
  io.emit("newGame");
}


// ----------------------------- MAIN ------------------------------ //


async function play() {

  // sync with s3 bucket
  await s3SyncFile(config_file);
  await s3SyncFile(game_file);

  // load the config
  config = await loadConfig();

  // to start the game from zero:
  // await initialize(true);

  // to continue a half-played game:
  await initialize(false);

  console.log("ready to play!");
}

play();


// we check constantly for changes in the game file:
fs.watchFile(
  game_file,
  {
    // check the file:
    persistent: true,
    // each ms:
    interval: 2000,
  },
  // and if there are changes:
  function (data) {
    fs.readFile(game_file, "utf8", (err, data_from_json) => {
      if (err) {
        console.error(err);
        //   throw err;
      }
      crossword.load(data_from_json);
    });
    // }
    // we send a simple 'server' message:
    io.emit("server", { message: "FileChanged" });

    // and we emit to all clients a 'fileChanged' message:
    io.emit("fileChanged");

    // and we console.log it:
    console.log("game_file changed!", data);
  }
);


// -------------------------- SOCKETS!!! --------------------------- //

// when a client connects:
io.on("connection", (socket) => {
  // this is the client address:
  var address = socket.conn.remoteAddress;
  // we show a message when someone connects:
  console.log(pretty_date(), " -> New connection from " + address);
  // and we increment our player counter:
  player_number++;

  // and keep the global max_player counter updated:
  if(max_player_number <= player_number) {
    max_player_number = player_number;
  }
  console.log("max_player_number:", max_player_number);

  // inform player of connection state!
  socket.emit("connection", true);

  // inform players of number of peers!
  io.emit("player_number", player_number);

  // always send an updated word list:
  socket.emit("fileChanged");

  // THE FUNCTION FOR RESETTING THE GAME:
  socket.on("reset", async function (width, height) {
    console.log("starting a new game...", width, height);
    config.game.width = width;
    config.game.height = height;
    saveConfig();
    s3SyncFile(config_file);
    await initialize(true);
  });

  // THE FUNCTION FOR ADDING WORDS:
  socket.on("create", function (event) {
    console.log("event -> ", event);

    // a data da sugestão:
    let datestring = pretty_date();

    // uma probabilidade de 50/50 de ser verdade:
    // let coube = Math.random() < 0.5;

    let coube = crossword.newWord(event.word, event.clue, datestring, address);

    console.log("coube: ??? ", coube);

    if (coube) {
      crossword.save(game_file);
      s3SyncFile(game_file);
      this.emit("perfect_fit");
      // and if the word doesn't fit, we tell them and why ( false=nofit, true=repeated ??? or is that a clue?):
    } else {
      this.emit("nofit");
    }
  });

  // THE FUNCTION FOR TRYING TO SOLVE WORDS:
  socket.on("solve", function (position, word) {
    console.log("solve! " + address);
    console.log("position: " + position + ", word: " + word);

    let h_true = false;
    let label;
    if (position.charAt(0) === "h") {
      h_true = true;
    }
    label = position.split("_")[1];

    // console.log("h_true:", h_true);
    // console.log("label:", label);

    // does the key exist?
    let key_of_try = Object.keys(crossword.words).find((palavra) => {
      console.log("palavra? ", crossword.words[palavra].word);
      console.log("label? ", crossword.words[palavra].label, " - label: ", label);
      console.log(
        "horizontal? ",
        crossword.words[palavra].horizontal,
        " - horizontal htrue: ",
        h_true
      );
      if (
        crossword.words[palavra].label == label &&
        crossword.words[palavra].horizontal === h_true
      ) {
        console.log(
          "é esta!!! crossword.words[palavra].word: ",
          crossword.words[palavra].word,
          " - word: ",
          word
        );
      }
      return (
        crossword.words[palavra].label == label && crossword.words[palavra].horizontal === h_true
      );
    });
    console.log("key H:", key_of_try);

    // we start as wrong :-)
    let right_answer = false;
    // we guess somebody is out to fool with us! :-)
    let cheater = false;

    // was that key good for the try?:
    if (key_of_try) {
      console.log(
        "crossword.words[key_of_try].word.toUpperCase()!",
        crossword.words[key_of_try].word.toUpperCase(),
        "latinize(word.toUpperCase()",
        latinize(word.toUpperCase())
      );
      if (crossword.words[key_of_try].player === address) {
        cheater = true;
      }
      if (
        latinize(crossword.words[key_of_try].word.toUpperCase()) ===
          latinize(word.toUpperCase()) &&
        crossword.words[key_of_try].player !== address
      ) {
        console.log("CORRECT!");
        crossword.words[key_of_try].solved = true;
        crossword.words[key_of_try].solvedtime = pretty_date();
        crossword.words[key_of_try].solveattempts += 1;
        right_answer = true;
      } else {
        crossword.words[key_of_try].solveattempts += 1;
      }
    }

    // se as palavras não eram suas sugestões:
    if (!cheater) {
      if (right_answer) {
        this.emit("right_answer");
      } else {
        this.emit("wrong_answer");
      }
      crossword.save(game_file);
      s3SyncFile(game_file);
    } else {
      // se as palavras eram suas não vale!
      this.emit("cheat_answer");
    }
  });

  // and something when a client disconnects:
  socket.on("disconnect", () => {
    console.log(pretty_date(), " -> Lost connection from " + address);
    player_number--;
    // console.log("players:", player_number);
    // inform players of number of peers!
    io.emit("player_number", player_number);
    // inform player of connection state!
    socket.emit("connection", false);
  });
}); // end of socket logic!

// ----------------------------------------------------------------- //

// we're ending!
console.log("we have reached the end...");
