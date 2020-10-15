import {SocketService} from './SocketService'
import {Paxos} from './Paxos'
import {PeerService} from './PeerService'
import {Subject} from 'rxjs'
let socketService: SocketService =SocketService.getInstance();
let messageRequestSubject = new Subject();
const totalPeersText = document.getElementById("total_peers_in_cluster");
const joinClusterBtn = document.getElementById("join_cluster_btn");
const sendMessageBtn = document.getElementById("send_message");
const messagesTxt = document.getElementById("messages");
const inputBox = document.getElementById("text_input");

let joiningCluster = false;

let peerService = new PeerService(socketService);
peerService.initPeerService();
const paxos = new Paxos(peerService, socketService, messageRequestSubject);
paxos.startPaxos();

let messagesToCommit:string[] = [];
generateRandomMessagesToCommit();
let requestInterval = getRandomInt(2000, 3000);

joinClusterBtn.addEventListener("click", () => {
    if(!joiningCluster) {
        joiningCluster = true;
        socketService.send("join_cluster", {});
    }
});

let sendMessageTimer = setInterval(() => {
    if(messagesToCommit.length > 0) {
        if(Paxos.canPropose) {
            messageRequestSubject.next(messagesToCommit.pop());
        }
    } else {
        clearInterval(sendMessageTimer);
    }
}, requestInterval);

sendMessageBtn.addEventListener("click", () => {
    peerService.broadcastMessage({messageType:"random message"});
});

function getRandomInt(min:number, max:number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomString(length:number) {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for ( var i = 0; i < length; i++ ) {
        result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
}

function generateRandomMessagesToCommit() {
    for(var j = 0; j < 3; j++) {
        messagesToCommit.push(getRandomString(20));
    }
}