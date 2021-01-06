"use strict";

(function () {
  // your page initialization code here
  // the DOM will be available here
  // our story begins:

  console.log("entrou o js!");

  // we start out in 'noplay' mode...
  let can_play = false;

  // the default timer:
  const timer = 2;

  const message_box = document.getElementById("mensagens");

  // a counter function:
  function setCounter(endtime) {
    let counter = endtime;
    can_play = false;
    const clock = document.getElementById("counter");
    const timeinterval = setInterval(() => {
      clock.innerHTML = counter + "";
      if (counter <= 0) {
        clearInterval(timeinterval);
        console.log("counter is over!!");
        clock.innerHTML = "";
        message_box.innerHTML = "<p class='message_top'>pode jogar!</p>";
        can_play = true;
      } else {
        counter--;
        document
          .getElementById("tab_2")
          .setAttribute("style", "display: none;");
        document
          .getElementById("tab_3")
          .setAttribute("style", "display: none;");
      }
      // we run this every second to count time!...:
    }, 1000);
  }

  // let the counter run:
  setCounter(timer);

  // some variables for our target lists:
  let nome_lista;

  let h_word_list = document.getElementById("lista_horizontais");
  let v_word_list = document.getElementById("lista_verticais");

  /* SOCKET LOGIC! */
  // our socket.io:
  let socket = io();
  // when we know the gamefile has changed...:
  socket.on("fileChanged", () => {
    console.log("lista_nova! ");
    nome_lista = "game.json";
    fetch("/" + nome_lista)
      .then((res) => res.json())
      .then((out) => {
        // horizontal words:
        let h = "";
        // vertical words:
        let v = "";
        // solved or not - they get crossed out by css:
        let className = "";
        out.words.forEach((element) => {
          if (element.solved === true) {
            className = "clickable_clue";
          } else {
            className = "clickable_clue active";
          }
          // console.log(key);
          // console.log(element);
          if (element.horizontal === true) {
            h +=
            '<li>' +
            "<span class='id_palavra'>" +
            element.label +
            "</span>" +
            '<a id="' +
            "h_" +
              element.label +
              '" class="' +
              className +
              '" href="#" onClick="return false;">' +
              element.clue +
              "</a>" +
              "<span class='tentativas'>" +
              element.solveattempts +
              "</span>" +
              "</li>";
          } else {
            v +=
              '<li>' +
              "<span class='id_palavra'>" +
              element.label +
              "</span>" +
              '<a id="' +
              "v_" +
              element.label +
              '" class="' +
              className +
              '" href="#" onClick="return false;">' +
              element.clue +
              "</a>" +
              "<span class='tentativas'>" +
              element.solveattempts +
              "</span>" +
              "</li>";
          }
        });
        // fill the divs up:
        h_word_list.innerHTML = h;
        v_word_list.innerHTML = v;
      })
      .catch((err) => {
        throw err;
      });
  });

  // CODE ONLY FOR THE PLOTTER -> :-) :
  // socket.on("server", (server) => {
  //   console.log("mensagem do server -> ", server);
  // });

  // on message type 'connection':
  // to get little green light :-)
  let connection_div = document.getElementById("connection");
  socket.on("connection", (connection) => {
    connection
      ? (connection_div.innerHTML = "<p>ligação: <span class='on'></span></p>")
      : (connection_div.innerHTML =
          "<p>ligação: <span class='off'></span></p>");
  });

  // on message type 'player_number':
  let player_number_div = document.getElementById("player_number");
  socket.on("player_number", (player_number) => {
    player_number_div.innerHTML = player_number;
  });

  // a way to send messages fomr the client TO the server, also via sockets:
  // function sendMessageToServer(message) {
  //   socket.emit("message", message);
  //   console.log("mensagem: " + message);
  // }

  // // a button to send the message:
  // document.getElementById("sendMessageToServer").onclick = function () {
  //   sendMessageToServer(new Date());
  // };

  //
  // general navigation buttons:
  //

  // create_button:
  document.getElementById("create_button").onclick = function (e) {
    e.preventDefault();
    if (can_play) {
      // document.getElementById("form_nova_palavra").focus();
      document.getElementById("tab_3").setAttribute("style", "display: none;");
      document.getElementById("tab_2").setAttribute("style", "display: flex;");
      document.getElementById("form_nova_palavra").focus();
      // console.log("click?");
      message_box.innerHTML = "<p class='message_top'>sugerir uma palavra</p>";
    } else {
      message_box.innerHTML =
        "<p class='message_top'>só mais um momento...</p>";
    }
  };

  // solve_button:
  document.getElementById("solve_button").onclick = function (e) {
    e.preventDefault();
    if (can_play) {
      document.getElementById("tab_2").setAttribute("style", "display: none;");
      document.getElementById("tab_3").setAttribute("style", "display: flex;");
      // console.log("click?");
      message_box.innerHTML = "<p class='message_top'>resolver uma palavra</p>";
    } else {
      message_box.innerHTML =
        "<p class='message_top'>só mais um momento...</p>";
    }
  };

  // suggesting a new word + clue:
  document.getElementById("suggest").onclick = function enviarSugestao() {
    // we start from a dirty word
    let clean_word = false;
    // we htmlstrip both word and clue
    let word_value = document
      .getElementById("form_nova_palavra")
      .value.replace(/(<([^>]+)>)/gi, "");
    let clue_value = document
      .getElementById("form_nova_pista")
      .value.replace(/(<([^>]+)>)/gi, "");

    // console.log("clue_value", clue_value);
    // console.log("clue_value.replace(/(<([^>]+)>)/gi,...", clue_value.replace(/(<([^>]+)>)/gi, ""));

    // the rules for accepting words:
    if (
      // we only accept characters from A to Z...
      !/[^a-z]/i.test(word_value) &&
      // !(word_value.indexOf(' ') !== -1) &&
      word_value.length > 1 &&
      word_value.length < 21 &&
      clue_value.length > 5
    ) {
      clean_word = true;
    }

    // if the word is 'clean':
    if (clean_word) {
      // we send it to the algorithm to see if it fits:
      socket.emit("create", {
        entrytime: new Date().toDateString(),
        word: word_value.toUpperCase(),
        clue: clue_value,
      });

      // and we clean the fields:
      document.getElementById("form_nova_palavra").value = "";
      document.getElementById("form_nova_pista").value = "";

      // and log it, just because:
      console.log("mensagem: " + word_value.toUpperCase(), clue_value);

      // message_box.innerHTML =
      //   "<p class='message_top'>Obrigado por participar - a sua palavra foi adicionada ao jogo!</p>";
      // and reset the counter:
      // setCounter(timer);
    } else {
      message_box.innerHTML =
        "<p class='message_top small_text'>mínimos e máximos: palavras de duas a 20 letras, de a-z, sem espaços, os acentos são ignorados<br>e a explicação tem de ter mais de 5 caracteres!</p>";
    }
  };

  // clicking things actions:
  document.addEventListener("click", function (e) {
    e.preventDefault();

    // console.log(e.target);

    // when someone clicks a clue to try to solve it:
    if (e.target && e.target.className == "clickable_clue active") {
      // console.log("pista!");
      // console.log("message_box: ", message_box);

      // we create a div to hold the question and a form for the answer-try:
      message_box.innerHTML =
        '<div id="div_resolve">' +
        "<p class='pergunta'>" +
        e.target.text +
        "?</p>" +
        '<input class="maiusculas" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="resposta?" type="text" id="' +
        e.target.id +
        '"><button id="resolver" type="submit">Enviar</button></div>';

      // console.log("click_resolver: " + e.target.id);
    }

    //and when you click submit, we sendi it!...
    if (e.target && e.target.id == "resolver") {
      // i send the proposal to the server (id=orientation+label; value=word_try):
      socket.emit(
        "solve",
        document.getElementById("div_resolve").childNodes[1].id,
        document.getElementById("div_resolve").childNodes[1].value.toUpperCase()
      );
      // console.log(
      //   "envio tentativa de resposta...",
      //   document.getElementById("div_resolve").childNodes[1]
      // );

      return false;
    }

    // a hidden reset button...
    if (e.target && e.target.id == "reset") {
      console.log("envio tentativa de resetar o jogo todo...");
      socket.emit("reset");

      return false;
    }
  });

  // if the word fits...
  socket.on("perfect_fit", () => {
    message_box.innerHTML =
      "<p class='message_top'>Obrigado por participar - a sua palavra foi adicionada ao jogo!</p>";
    console.log("a palavra foi acrescentada ao jogo!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(timer);
  });

  // if the word doesn't fit...
  socket.on("nofit", (why) => {
    // if (why) {
    //   message_box.innerHTML =
    //     "<p class='message_top'>essa palavra já existe...</p>";
    //   console.log("essa palavra já existe...");
    // } else {
    message_box.innerHTML =
      "<p class='message_top'>ups, essa palavra não coube no jogo...</p>";
    console.log("ups, essa palavra não coube no jogo...");
    // }
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(timer);
  });

  // quando se recebe uma mensagem de 'resposta certa!!'
  socket.on("right_answer", () => {
    message_box.innerHTML =
      "<p class='message_top'>PARABÉNS - acertou na resposta certa!</p>";
    console.log("acertámos numa palavra!!!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(timer);
  });

  // quando se recebe uma mensagem de 'resposta errada!!'
  socket.on("wrong_answer", () => {
    message_box.innerHTML =
      "<p class='message_top'>ohhhh - falhou! melhor sorte para a próxima...</p>";
    console.log("falhei...!!!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(timer);
  });

  // quando se recebe uma mensagem de 'resposta aldrabada!!'
  socket.on("cheat_answer", () => {
    message_box.innerHTML =
      "<p class='message_top'>tentar acertar nas suas próprias palavras não vale...</p>";
    console.log("fui apanhado a aldrabar...!!!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(30);
  });

  // we have reached the end of the js!:
  console.log("acabou o js...");
})();
