const socket = io();

const createRoomButton =
  document.getElementById("createRoomButton");

const joinCreatedRoomButton =
  document.getElementById("joinCreatedRoomButton");

const joinInviteButton =
  document.getElementById("joinInviteButton");

const inviteArea =
  document.getElementById("inviteArea");

const incomingRoomArea =
  document.getElementById("incomingRoomArea");

const inviteUrl =
  document.getElementById("inviteUrl");

const copyButton =
  document.getElementById("copyButton");

const startArea =
  document.getElementById("startArea");

const callArea =
  document.getElementById("callArea");

const localVideo =
  document.getElementById("localVideo");

const remoteVideo =
  document.getElementById("remoteVideo");

const micButton =
  document.getElementById("micButton");

const cameraButton =
  document.getElementById("cameraButton");

const hangupButton =
  document.getElementById("hangupButton");

const statusText =
  document.getElementById("status");


let roomId = null;
let localStream = null;
let peerConnection = null;


// WebRTC設定
const configuration = {

  iceServers: [

    {
      urls: "stun:stun.l.google.com:19302"
    }

  ]

};


// URLからルームID取得
const params =
  new URLSearchParams(window.location.search);

const roomFromUrl =
  params.get("room");


if (roomFromUrl) {

  roomId = roomFromUrl;

  createRoomButton.classList.add("hidden");

  incomingRoomArea.classList.remove("hidden");

  statusText.textContent =
    "通話への招待があります";

}


// ランダムなルームID生成
function createRoomId() {

  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);

}


// 新しい通話を作成
createRoomButton.addEventListener(
  "click",
  () => {

    roomId = createRoomId();

    const url =
      `${window.location.origin}/?room=${roomId}`;

    inviteUrl.value = url;

    inviteArea.classList.remove("hidden");

    createRoomButton.classList.add("hidden");

    history.replaceState(
      {},
      "",
      `?room=${roomId}`
    );

    statusText.textContent =
      "通話URLを作成しました";

  }
);


// URLコピー
copyButton.addEventListener(
  "click",
  async () => {

    try {

      await navigator.clipboard.writeText(
        inviteUrl.value
      );

      copyButton.textContent =
        "コピーしました！";

      setTimeout(() => {

        copyButton.textContent =
          "コピー";

      }, 2000);

    } catch (error) {

      console.error(error);

      inviteUrl.select();

    }

  }
);


// 作成者が参加
joinCreatedRoomButton.addEventListener(
  "click",
  () => {

    joinRoom();

  }
);


// 招待された側が参加
joinInviteButton.addEventListener(
  "click",
  () => {

    joinRoom();

  }
);


// カメラ・マイク開始
async function startCamera() {

  localStream =
    await navigator.mediaDevices.getUserMedia({

      video: true,

      audio: true

    });

  localVideo.srcObject =
    localStream;

}


// 通話参加
async function joinRoom() {

  try {

    statusText.textContent =
      "カメラとマイクを準備しています...";

    await startCamera();

    startArea.classList.add("hidden");

    callArea.classList.remove("hidden");

    socket.emit(
      "join-room",
      roomId
    );

    statusText.textContent =
      "接続中...";

  }

  catch (error) {

    console.error(error);

    alert(
      "カメラまたはマイクを使用できませんでした。ブラウザの許可を確認してください。"
    );

  }

}


// WebRTC接続作成
function createPeerConnection() {

  peerConnection =
    new RTCPeerConnection(
      configuration
    );


  localStream
    .getTracks()
    .forEach(track => {

      peerConnection.addTrack(
        track,
        localStream
      );

    });


  peerConnection.ontrack =
    event => {

      remoteVideo.srcObject =
        event.streams[0];

    };


  peerConnection.onicecandidate =
    event => {

      if (event.candidate) {

        socket.emit(
          "ice-candidate",
          {

            roomId,

            candidate:
              event.candidate

          }
        );

      }

    };


  peerConnection.onconnectionstatechange =
    () => {

      if (!peerConnection) return;

      if (
        peerConnection.connectionState
        === "connected"
      ) {

        statusText.textContent =
          "通話中";

      }

      if (
        peerConnection.connectionState
        === "disconnected"
      ) {

        statusText.textContent =
          "相手との接続が切れました";

      }

    };

}


// 1人目
socket.on(
  "waiting",
  () => {

    statusText.textContent =
      "相手の参加を待っています...";

  }
);


// 2人目が入室
socket.on(
  "user-joined",
  async () => {

    statusText.textContent =
      "相手が参加しました";

    createPeerConnection();

    const offer =
      await peerConnection.createOffer();

    await peerConnection
      .setLocalDescription(
        offer
      );

    socket.emit(
      "offer",
      {

        roomId,

        offer

      }
    );

  }
);


// Offer受信
socket.on(
  "offer",
  async offer => {

    createPeerConnection();

    await peerConnection
      .setRemoteDescription(
        offer
      );

    const answer =
      await peerConnection
        .createAnswer();

    await peerConnection
      .setLocalDescription(
        answer
      );

    socket.emit(
      "answer",
      {

        roomId,

        answer

      }
    );

  }
);


// Answer受信
socket.on(
  "answer",
  async answer => {

    await peerConnection
      .setRemoteDescription(
        answer
      );

  }
);


// ICE Candidate受信
socket.on(
  "ice-candidate",
  async candidate => {

    if (
      peerConnection &&
      candidate
    ) {

      try {

        await peerConnection
          .addIceCandidate(
            candidate
          );

      }

      catch (error) {

        console.error(
          "ICE candidate error:",
          error
        );

      }

    }

  }
);


// 3人目
socket.on(
  "room-full",
  () => {

    alert(
      "この通話にはすでに2人参加しています"
    );

    endCall();

  }
);


// マイク切替
micButton.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const audioTrack =
      localStream
        .getAudioTracks()[0];

    if (!audioTrack) return;

    audioTrack.enabled =
      !audioTrack.enabled;

    micButton.textContent =
      audioTrack.enabled
        ? "🎤 マイクOFF"
        : "🔇 マイクON";

  }
);


// カメラ切替
cameraButton.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const videoTrack =
      localStream
        .getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled =
      !videoTrack.enabled;

    cameraButton.textContent =
      videoTrack.enabled
        ? "📷 カメラOFF"
        : "🚫 カメラON";

  }
);


// 終了
hangupButton.addEventListener(
  "click",
  () => {

    endCall();

  }
);


function endCall() {

  if (peerConnection) {

    peerConnection.close();

    peerConnection = null;

  }


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    localStream = null;

  }


  localVideo.srcObject = null;

  remoteVideo.srcObject = null;


  callArea.classList.add(
    "hidden"
  );

  startArea.classList.remove(
    "hidden"
  );


  statusText.textContent =
    "通話を終了しました";


  incomingRoomArea.classList.remove(
    "hidden"
  );

}