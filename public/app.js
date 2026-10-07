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

const copyUrlButton =
  document.getElementById("copyUrlButton");

const copyPasswordButton =
  document.getElementById("copyPasswordButton");

const generatedPassword =
  document.getElementById("generatedPassword");

const passwordInput =
  document.getElementById("passwordInput");

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
let roomPassword = null;
let localStream = null;
let peerConnection = null;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};

const params =
  new URLSearchParams(window.location.search);

const roomFromUrl =
  params.get("room");

if (roomFromUrl) {
  roomId = roomFromUrl;

  createRoomButton.classList.add("hidden");
  incomingRoomArea.classList.remove("hidden");

  statusText.textContent =
    "パスワードを入力して参加してください";
}

function createRoomId() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 16);
}

createRoomButton.addEventListener(
  "click",
  () => {
    roomId = createRoomId();

    socket.emit("create-room", roomId);

    statusText.textContent =
      "安全な通話ルームを作成しています...";
  }
);

socket.on(
  "room-created",
  ({ roomId: createdRoomId, password }) => {
    roomId = createdRoomId;
    roomPassword = password;

    const url =
      `${window.location.origin}/?room=${roomId}`;

    inviteUrl.value = url;
    generatedPassword.textContent = password;

    inviteArea.classList.remove("hidden");
    createRoomButton.classList.add("hidden");

    history.replaceState(
      {},
      "",
      `?room=${roomId}`
    );

    statusText.textContent =
      "通話URLとパスワードを作成しました";
  }
);

copyUrlButton.addEventListener(
  "click",
  async () => {
    try {
      await navigator.clipboard.writeText(
        inviteUrl.value
      );

      copyUrlButton.textContent =
        "コピーしました";

      setTimeout(() => {
        copyUrlButton.textContent =
          "URLコピー";
      }, 1500);
    } catch (error) {
      console.error(error);
    }
  }
);

copyPasswordButton.addEventListener(
  "click",
  async () => {
    try {
      await navigator.clipboard.writeText(
        generatedPassword.textContent
      );

      copyPasswordButton.textContent =
        "コピーしました";

      setTimeout(() => {
        copyPasswordButton.textContent =
          "コピー";
      }, 1500);
    } catch (error) {
      console.error(error);
    }
  }
);

joinCreatedRoomButton.addEventListener(
  "click",
  () => {
    joinRoom(roomPassword);
  }
);

joinInviteButton.addEventListener(
  "click",
  () => {
    const enteredPassword =
      passwordInput.value.trim();

    if (enteredPassword.length !== 6) {
      alert("6桁のパスワードを入力してください");
      return;
    }

    joinRoom(enteredPassword);
  }
);

async function startCamera() {
  localStream =
    await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

  localVideo.srcObject =
    localStream;
}

async function joinRoom(password) {
  try {
    statusText.textContent =
      "カメラとマイクを準備しています...";

    await startCamera();

    socket.emit(
      "join-room",
      {
        roomId,
        password
      }
    );

    statusText.textContent =
      "認証中...";
  } catch (error) {
    console.error(error);

    alert(
      "カメラまたはマイクを使用できませんでした"
    );
  }
}

function showCallArea() {
  startArea.classList.add("hidden");
  callArea.classList.remove("hidden");
}

function createPeerConnection() {
  peerConnection =
    new RTCPeerConnection(configuration);

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
        peerConnection.connectionState ===
        "connected"
      ) {
        statusText.textContent =
          "通話中";
      }

      if (
        peerConnection.connectionState ===
        "disconnected"
      ) {
        statusText.textContent =
          "相手との接続が切れました";
      }
    };
}

socket.on(
  "waiting",
  () => {
    showCallArea();

    statusText.textContent =
      "相手の参加を待っています...";
  }
);

socket.on(
  "ready",
  () => {
    showCallArea();

    statusText.textContent =
      "相手と接続しています...";
  }
);

socket.on(
  "user-joined",
  async () => {
    showCallArea();

    statusText.textContent =
      "相手が参加しました";

    createPeerConnection();

    const offer =
      await peerConnection.createOffer();

    await peerConnection
      .setLocalDescription(offer);

    socket.emit(
      "offer",
      {
        roomId,
        offer
      }
    );
  }
);

socket.on(
  "offer",
  async offer => {
    showCallArea();

    createPeerConnection();

    await peerConnection
      .setRemoteDescription(offer);

    const answer =
      await peerConnection
        .createAnswer();

    await peerConnection
      .setLocalDescription(answer);

    socket.emit(
      "answer",
      {
        roomId,
        answer
      }
    );
  }
);

socket.on(
  "answer",
  async answer => {
    if (!peerConnection) return;

    await peerConnection
      .setRemoteDescription(answer);
  }
);

socket.on(
  "ice-candidate",
  async candidate => {
    if (
      peerConnection &&
      candidate
    ) {
      try {
        await peerConnection
          .addIceCandidate(candidate);
      } catch (error) {
        console.error(
          "ICE candidate error:",
          error
        );
      }
    }
  }
);

socket.on(
  "wrong-password",
  () => {
    stopLocalStream();

    statusText.textContent =
      "パスワードが違います";

    alert("パスワードが違います");
  }
);

socket.on(
  "room-not-found",
  () => {
    stopLocalStream();

    statusText.textContent =
      "この通話ルームは存在しません";

    alert(
      "この通話ルームは無効、または終了しています"
    );
  }
);

socket.on(
  "room-full",
  () => {
    stopLocalStream();

    statusText.textContent =
      "この通話は満員です";

    alert(
      "この通話にはすでに2人参加しています"
    );
  }
);

socket.on(
  "user-left",
  () => {
    remoteVideo.srcObject = null;

    statusText.textContent =
      "相手が退出しました";
  }
);

micButton.addEventListener(
  "click",
  () => {
    if (!localStream) return;

    const audioTrack =
      localStream.getAudioTracks()[0];

    if (!audioTrack) return;

    audioTrack.enabled =
      !audioTrack.enabled;

    micButton.textContent =
      audioTrack.enabled
        ? "🎤 マイクOFF"
        : "🔇 マイクON";
  }
);

cameraButton.addEventListener(
  "click",
  () => {
    if (!localStream) return;

    const videoTrack =
      localStream.getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled =
      !videoTrack.enabled;

    cameraButton.textContent =
      videoTrack.enabled
        ? "📷 カメラOFF"
        : "🚫 カメラON";
  }
);

hangupButton.addEventListener(
  "click",
  () => {
    socket.emit("leave-room");
    endCall();
  }
);

function stopLocalStream() {
  if (localStream) {
    localStream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    localStream = null;
  }

  localVideo.srcObject = null;
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  stopLocalStream();

  remoteVideo.srcObject = null;

  callArea.classList.add("hidden");
  startArea.classList.remove("hidden");

  statusText.textContent =
    "通話を終了しました";
}