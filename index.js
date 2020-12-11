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
let game_folder = "./old_games/";
let game_file = "./game.json";

// we start with 0 players
let player_number = 0;

// blank slate for gamestate
let gamestate;
// blank starttime!
let starttime;
// what is this grid thing?
let grid = { width: 23, height: 16 };
// words array:
let words = [];

// a function onStart:
function initialize(json = null) {
  // if 'json' is true, we're good to go:
  if (json !== null) {
    // read json and fill our arrays:
    fs.readFile(game_file, "utf8", (err, data_from_json) => {
      if (err) {
        console.error(err);
        throw err;
      }
      gamestate = JSON.parse(data_from_json);
      starttime = gamestate.starttime;
      grid = gamestate.grid;
      words = gamestate.words;
    });
    // and mark game as active:
    game_active = true;
  }
  // if we don't have json, we backup the old one and start anew:
  else {
    fs.rename(
      game_file,
      game_folder + pretty_computer_date() + ".json",
      function (err) {
        if (err) {
          throw err;
        } else {
          fs.writeFile(
            game_file,
            JSON.stringify(
              { start_time: pretty_date(), grid: grid, words: words },
              null,
              1
            ),
            function (err) {
              if (err) {
                return console.log(err);
              }
              console.log(
                "we created a new fresh json, because you asked me to!"
              );
              // and mark game as active:
              game_active = true;
            }
          );
        }
        console.log("the backup is done!");
      }
    );
  }
}

// to start the game from zero:
// initialize();

// to continue a half-played game:
initialize(true);

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
      gamestate = JSON.parse(data_from_json);
      grid = gamestate.grid;
      words = gamestate.words;
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
    initialize();
  });

  // THE FUNCTION FOR ADDING WORDS:
  socket.on("create", function (event) {
    console.log(event);

    // a data da sugestão:
    let datestring = pretty_date();

    // uma probabilidade de 50/50 de ser verdade:
    let coube = Math.random() < 0.5;

    let concerteza = false;

    if (coube) {
      concerteza = {
        // word: "palavranova",
        // clue: "aqui vem a pista!",
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        label: Math.floor(Math.random() * 100),
        horizontal: Math.random() < 0.5,
        word: event.word,
        clue: event.clue,
        // x: event.x,
        // y: event.y,
        // label: event.label,
        // horizontal: event.horizontal,
      };
    }

    // let concerteza = wordsearch(event.palavra.toUpperCase(), event.pista);
    console.log("concerteza: " + JSON.stringify(concerteza));

    // se o algoritmo disser algo diferente de impossível...:
    if (concerteza) {
      words.push({
        word: concerteza.word,
        clue: concerteza.clue,
        x: concerteza.x,
        y: concerteza.y,
        label: concerteza.label,
        horizontal: concerteza.horizontal,
        solved: false,
        entrytime: datestring,
        solvedtime: -1,
        solveattempts: 0,
        player: address,
      });
      fs.writeFile(
        game_file,
        JSON.stringify(
          { start_time: starttime, grid: grid, words: words },
          null,
          1
        ),
        function (err) {
          if (err) return console.log(err);
        }
      );
      // and if the word doesn't fit, we tell them and why ( false=nofit, true=repeated ??? or is that a clue?):
    } else {
      this.emit('nofit', Math.random() < 0.5);
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
    let key_of_try = Object.keys(words).find((palavra) => {
      console.log("palavra? ", words[palavra].word);
      console.log("label? ", words[palavra].label, " - label: ", label);
      console.log("horizontal? ", words[palavra].horizontal, " - horizontal htrue: ", h_true);
      if (words[palavra].label == label && words[palavra].horizontal === h_true) {
        console.log("é esta!!! words[palavra].word: ", words[palavra].word, " - word: ", word);
      }
      return (
        words[palavra].label == label && words[palavra].horizontal === h_true
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
        "words[key_of_try].word.toUpperCase()!",
        words[key_of_try].word.toUpperCase(),
        "latinize(word.toUpperCase()",
        latinize(word.toUpperCase())
      );
      if (words[key_of_try].player === address) {
        cheater = true;
      }
      if (
        latinize(words[key_of_try].word.toUpperCase()) ===
          latinize(word.toUpperCase()) &&
        words[key_of_try].player !== address
      ) {
        console.log("CORRECT!");
        words[key_of_try].solved = true;
        words[key_of_try].solvedtime = pretty_date();
        right_answer = true;
      } else {
        words[key_of_try].solveattempts += 1;
      }
    }

    // se as palavras não eram suas sugestões:
    if (!cheater) {
      if (right_answer) {
        this.emit("resposta_certa");
      } else {
        this.emit("resposta_errada");
      }
      fs.writeFile(
        game_file,
        JSON.stringify(
          { start_time: starttime, grid: grid, words: words },
          null,
          1
        ),
        function (err) {
          if (err) return console.log(err);
        }
      );
    } else {
      // se as palavras eram suas não vale!
      this.emit("resposta_aldrabada");
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
