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

// create the crossword object, game size is set in initialize()
let crossword = new Crossword(0,0);

console.log(latinize("ỆᶍǍᶆṔƚÉ áéíóúýčďěňřšťžů")); // => 'ExAmPlE aeiouycdenrstzu');

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

let game_active = false;
const aws_bucket = "http://s3.amazonaws.com/palavras-cruzadas-server"
const game_folder = aws_bucket + "/old_games/";
const game_file = aws_bucket + "/game.json";
const config_file = aws_bucket + "/config.json"

// load config file
let config;
try {
  config = JSON.parse(fs.readFileSync(config_file, 'utf8'));
} catch (err) {
  return console.log(err);
}

// we start with 0 players
let player_number = 0;

// a function onStart:
function initialize(new_game) {
  // if we want to reload an existing game
  if (!new_game) {
    // read json and fill our arrays:
    fs.readFile(game_file, "utf8", (err, data_from_json) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // if no json file, start a new game
          console.log('no game file found, starting a new game');
          crossword.start_time = pretty_date();
          crossword.init(config.game.width, config.game.height);
          crossword.save(game_file);
          game_active = true;

          // let the clients know so they can initialise the game grid
          io.emit("server", { message: "newGame" });
          io.emit("newGame");
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
    fs.rename(
      game_file,
      game_folder + pretty_computer_date() + ".json",
      function (err) {
        if (err) {
          throw err;
        } else {
          crossword.start_time = pretty_date();

          // create a new game, initing crossword part:
          crossword.init(config.game.width, config.game.height);
          // start a new json:
          crossword.save(game_file);
          // and mark game as active:
          game_active = true;

          // let the clients know so they can initialise the game grid
          io.emit("server", { message: "newGame" });
          io.emit("newGame");
        }
        console.log("the backup is done!");
      }
    );
  }
}

// to start the game from zero:
// initialize(true);

// to continue a half-played game:
initialize(false);

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

// SOCKETS!!!
// when a client connects:
io.on("connection", (socket) => {
  // this is the client address:
  var address = socket.conn.remoteAddress;
  // we show a message when someone connects:
  console.log(pretty_date(), " -> New connection from " + address);
  // and we increment our player counter:
  player_number++;
  // console.log("players:", player_number);

  // inform player of connection state!
  socket.emit("connection", true);

  // inform players of number of peers!
  io.emit("player_number", player_number);

  // always send an updated word list:
  socket.emit("fileChanged");

  // THE FUNCTION FOR RESETTING THE GAME:
  socket.on("reset", function (event) {
    initialize(true);
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

// we're ending!
console.log("we have reached the end...");
