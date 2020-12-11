"use strict";

(function () {
  // your page initialization code here
  // the DOM will be available here
  // começa a história:

  console.log("entrou o js!");

  // começa por NÃO se poder jogar...
  let permitidoJogar = false;

  // o tempo de espera para se poder jogar de novo:
  const timer = 2;

  const caixa_de_mensagens = document.getElementById("mensagens");

  // temos uma função para fazer de contador:
  function setCounter(endtime) {
    let contador = endtime;
    permitidoJogar = false;
    const clock = document.getElementById("contador");
    const timeinterval = setInterval(() => {
      clock.innerHTML = contador + "";
      if (contador <= 0) {
        clearInterval(timeinterval);
        console.log("acabou a contagem!!");
        clock.innerHTML = "";
        caixa_de_mensagens.innerHTML =
          "<p class='mensagem_cimo'>pode jogar!</p>";
        permitidoJogar = true;
      } else {
        contador--;
        document
          .getElementById("tab_2")
          .setAttribute("style", "display: none;");
        document
          .getElementById("tab_3")
          .setAttribute("style", "display: none;");
      }
      // mandamos correr todos os segundos:
    }, 1000);
  }

  // para fazer correr o contador:
  setCounter(timer);

  // defininimos o socket.io:
  let socket = io();

  // definimos umas variáveis para guardar os pointers para os nossos 'alvos'...
  let nome_lista;


  let lista_palavras_h = document.getElementById("lista_horizontais");
  let lista_palavras_v = document.getElementById("lista_verticais");
  // when we know the gamefile has changed...:
  socket.on("fileChanged", () => {
    console.log("lista_nova! ");
    nome_lista = 'game.json';
    // objectoJSON = JSON.parse(lista);
    fetch("/" + nome_lista)
      .then((res) => res.json())
      .then((out) => {
        // grid = words.grid;
        // words = words.words;
        // console.log("Checkout this JSON! ", out);
        let h = "";
        let v = "";
        let className = "";
        out.words.forEach((element) => {
          if(element.solved===true) {className = 'pista_clicavel' } else {className = 'pista_clicavel active';}
          // console.log(key);
          // console.log(element);
          if (element.horizontal === true) {
            h +=
              '<li><a id="' +
              'h_'+element.label +
              '" class="'+className+'" href="#" onClick="return false;">' +
              element.clue +
              "</a></li>";
          }
          else {
            v +=
            '<li><a id="' +
            'v_'+element.label +
            '" class="'+className+'" href="#" onClick="return false;">' +
            element.clue +
            "</a></li>";
          }
        });
        lista_palavras_h.innerHTML = h;
        lista_palavras_v.innerHTML = v;
      })
      .catch((err) => {
        throw err;
      });
  });

  // quando recebermos a mensagem 'server', fazemos o seguinte:
  // socket.on("server", (server) => {
  //   console.log("mensagem do server -> ", server);
  // });


  // quando recebermos a mensagem 'connection', fazemos o seguinte:
  let connection_div = document.getElementById("connection");
  socket.on("connection", (connection) => {
    connection ? connection_div.innerHTML = "<p class='on'></p>" : connection_div.innerHTML = "---";
  });


  // quando recebermos a mensagem 'player_number', fazemos o seguinte:
  let player_number_div = document.getElementById("player_number");
  socket.on("player_number", (player_number) => {
    player_number_div.innerHTML = player_number;
  });

  // caminho inverso - send a message to server, also via sockets:
  function sendMessageToServer(message) {
    // socket emit:
    socket.emit("message", message);
    // e log também, só porque sim:
    console.log("mensagem: " + message);
  }

  // definimos um botão que envia a mensagem ao server, ao ser clicado:
  document.getElementById("sendMessageToServer").onclick = function () {
    sendMessageToServer(new Date());
  };

  // definimos os botões que mostram os divs, ao serem clicados:

  // o botão de sugerir:
  document.getElementById("botao_sugerir").onclick = function (e) {
    e.preventDefault();
    if (permitidoJogar) {
      document.getElementById("tab_3").setAttribute("style", "display: none;");
      document.getElementById("tab_2").setAttribute("style", "display: flex;");
      // console.log("click?");
      caixa_de_mensagens.innerHTML =
        "<p class='mensagem_cimo'>sugerir uma palavra</p>";
    } else {
      caixa_de_mensagens.innerHTML =
        "<p class='mensagem_cimo'>só mais um momento...</p>";
    }
  };

  // o botão de resolver:
  document.getElementById("botao_resolver").onclick = function (e) {
    e.preventDefault();
    if (permitidoJogar) {
      document.getElementById("tab_2").setAttribute("style", "display: none;");
      document.getElementById("tab_3").setAttribute("style", "display: flex;");
      // console.log("click?");
      caixa_de_mensagens.innerHTML =
        "<p class='mensagem_cimo'>resolver uma palavra</p>";
    } else {
      caixa_de_mensagens.innerHTML =
        "<p class='mensagem_cimo'>só mais um momento...</p>";
    }
  };

  // quando alguém quer acrescentar uma nova palavra+pista:
  document.getElementById("sugerir").onclick = function enviarSugestao() {
    let tudo_limpo = false;
    let s_palavra = document.getElementById("form_nova_palavra").value;
    let s_pista = document.getElementById("form_nova_pista").value;
    if (s_palavra.length > 1 && s_palavra.length < 21 && s_pista.length > 5) {
      tudo_limpo = true;
    }
    if (tudo_limpo) {
      socket.emit("create", {
        entrytime: new Date().toDateString(),
        word: s_palavra.toUpperCase(),
        clue: s_pista,
      });

      // apagamos os campos:
      document.getElementById("form_nova_palavra").value = "";
      document.getElementById("form_nova_pista").value = "";

      // e log também, só porque sim:
      console.log("mensagem: " + s_palavra.toUpperCase(), s_pista);

      caixa_de_mensagens.innerHTML =
        "<p class='mensagem_cimo'>Obrigado por participar - a sua palavra foi adicionada ao jogo!</p>";
      // e reiniciamos o contador:
      setCounter(timer);
    } else {
      caixa_de_mensagens.innerHTML =
        "<p class='mensagem_cimo texto_pequeno'>mínimos e máximos: palavras de duas a 20 letras, de a-z, sem espaços, os acentos são ignorados<br>e a explicação tem de ter mais de 5 caracteres!</p>";
    }
  };

  // diversas ações relacionadas com click em coisas...
  document.addEventListener("click", function (e) {
    e.preventDefault();

    // console.log(e.target);

    // a lógica de criar a caixa de resolver uma palavra:
    if (e.target && e.target.className == "pista_clicavel active") {
      // console.log("pista!");
      // console.log("caixa_de_mensagens: ", caixa_de_mensagens);

      caixa_de_mensagens.innerHTML =
        '<div id="div_resolve" />' +
        "<p class='pergunta'>" +
        e.target.text +
        "?</p>" +
        '<input class="maiusculas" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="resposta?" type="text" id="' +
        e.target.id +
        '"><button id="resolver" type="submit">Enviar</button>';

      // console.log("click_resolver: " + e.target.id);
    }

    // e a lógica de ver se a palavra é aceite ou não...
    if (e.target && e.target.id == "resolver") {
      console.log(
        "envio tentativa de resposta...",
        document.getElementById("div_resolve").childNodes[1]
      );
      socket.emit(
        "solve",
        document.getElementById("div_resolve").childNodes[1].id,
        document.getElementById("div_resolve").childNodes[1].value.toUpperCase()
      );

      return false;
    }
  });

  // quando se recebe uma mensagem de 'resposta certa!!'
  socket.on("resposta_certa", () => {
    caixa_de_mensagens.innerHTML =
      "<p class='mensagem_cimo'>PARABÉNS - acertou na resposta certa!</p>";
    console.log("acertámos numa palavra!!!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(timer);
  });

  // quando se recebe uma mensagem de 'resposta errada!!'
  socket.on("resposta_errada", () => {
    caixa_de_mensagens.innerHTML =
      "<p class='mensagem_cimo'>ohhhh - falhou! melhor sorte para a próxima...</p>";
    console.log("falhei...!!!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(timer);
  });

  // quando se recebe uma mensagem de 'resposta aldrabada!!'
  socket.on("resposta_aldrabada", () => {
    caixa_de_mensagens.innerHTML =
      "<p class='mensagem_cimo'>tentar acertar nas suas próprias palavras não vale...</p>";
    console.log("fui apanhado a aldrabar...!!!");
    document.getElementById("tab_2").setAttribute("style", "display: none;");
    document.getElementById("tab_3").setAttribute("style", "display: none;");
    setCounter(30);
  });

  // e chegámos ao fim da história:
  console.log("acabou o js...");
})();
