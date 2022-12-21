import "./style.css";

import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    setDoc,
    onSnapshot,
    updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDTHS9Siois3VpnyOBVGMdWnni6dVHyoNc",
    authDomain: "video-chat-c.firebaseapp.com",
    databaseURL: "https://video-chat-c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "video-chat-c",
    storageBucket: "video-chat-c.appspot.com",
    messagingSenderId: "3626357291",
    appId: "1:3626357291:web:702ce1f1c5ae47ad2e906e",
    measurementId: "G-LXDGLVD1VX",
};

const firebase = initializeApp(firebaseConfig);

const db = getFirestore(firebase);

const servers = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302"],
        },
        {
            urls: "turn:relay.metered.ca:80",
            username: "0490027236e3e76afa52112c",
            credential: "zvfXe6Y6Tmsl+FZM",
        },
        {
            urls: "turn:relay.metered.ca:443",
            username: "0490027236e3e76afa52112c",
            credential: "zvfXe6Y6Tmsl+FZM",
        },
        {
            urls: "turn:relay.metered.ca:443?transport=tcp",
            username: "0490027236e3e76afa52112c",
            credential: "zvfXe6Y6Tmsl+FZM",
        },
    ],
    iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);

let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById("webcamButton");
const webcamVideo = document.getElementById("webcamVideo");
const callButton = document.getElementById("callButton");
const callInput = document.getElementById("callInput");
const answerButton = document.getElementById("answerButton");
const remoteVideo = document.getElementById("remoteVideo");
const hangupButton = document.getElementById("hangupButton");

webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
};

callButton.onclick = async () => {
    const callDoc = await doc(collection(db, "calls"));
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    callInput.value = callDoc.id;

    pc.onicecandidate = (event) => {
        event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer(); // creating webrtc offer
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };

    await setDoc(callDoc, { offer });

    onSnapshot(callDoc, (snapShot) => {
        const data = snapShot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
    });

    onSnapshot(answerCandidates, (snapShot) => {
        snapShot.docChanges().forEach((change) => {
            if (change.type == "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
};

answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = doc(db, "calls", callId);
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const callData = (await getDoc(callDoc)).data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer });

    onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
};
