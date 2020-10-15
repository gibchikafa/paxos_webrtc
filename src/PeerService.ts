import { SocketService } from './SocketService'
import * as MessageTypes from './types';
let Peer = require('simple-peer')
import { fromEvent, Observable, Subject } from 'rxjs';
import { PaxosPeer } from './PaxosPeer'
import { Paxos } from './Paxos';
export class PeerService {
    private allPeers: PaxosPeer[] = [];
    private socketService: SocketService;
    public static peerMessageSubject = new Subject();
    public static clusterPeersEnough = new Subject();
    private myPeerId: string;
    private clusterSize: number = 2;

    constructor(socketService: SocketService) {
        this.socketService = socketService;
    }

    public initPeerService(): void {
        let onMyPeerIdObservable = this.socketService.onMyPeerId();
        onMyPeerIdObservable.subscribe((m: MessageTypes.MyPeerIdMessage) => {
            this.myPeerId = m.myPeerId;
        })

        let onJoinMessageObservable = this.socketService.onJoinMessage();
        onJoinMessageObservable.subscribe((m: MessageTypes.JoinClusterSocketMessage) => {
            m.peers.forEach(peerID => {
                const peer = this.createPeer(peerID, this.myPeerId);
                this.allPeers.push(new PaxosPeer(peerID, peer));
            });

            if(m.peers.length + 1 == this.clusterSize) {
                console.log(this.allPeers);
                PeerService.clusterPeersEnough.next(true)
            }
        });

        let onPeerJoiningObservable = this.socketService.onPeerJoining();
        onPeerJoiningObservable.subscribe((m: MessageTypes.PeerJoiningSocketMessage) => {
            const peer = this.addPeer(m.signal, m.peerID);
            this.allPeers.push(new PaxosPeer(m.peerID, peer));

            if(this.allPeers.length + 1 == this.clusterSize) {
                console.log(this.allPeers);
                PeerService.clusterPeersEnough.next(true)
            }
        });

        let onReturnedSignalObervable = this.socketService.onReturnedSignal();
        onReturnedSignalObervable.subscribe((m: MessageTypes.ReturnedSignalMessage) => {
            const item = this.allPeers.find(p => p.getPeerId() === m.id);
            item.getPeer().signal(m.signal);
        });

        let onPeerDisconnectedObservable = this.socketService.onPeerDisconnected();
        onPeerDisconnectedObservable.subscribe((m: MessageTypes.PeerDisconnectedMessage) => {
            if(this.allPeers && this.allPeers.length > 0) {
                let remainingPeers = this.allPeers.filter(p => p.getPeerId() != m.peerID);
                this.allPeers = remainingPeers;
            }
        });

        let paxosBroadcastMessageObserver = Paxos.paxosBroadCastMessageSubject;
        paxosBroadcastMessageObserver.subscribe((m:MessageTypes.PaxosMessage) => {
            //send to all peers
            this.allPeers.forEach(p => p.getPeer().send(JSON.stringify(m)));
            //send to yourself
            PeerService.peerMessageSubject.next(m);
        });

        let paxosToPeerMessageObserver = Paxos.paxosToPeerMessageSubject;
        paxosToPeerMessageObserver.subscribe((m:MessageTypes.PaxosMessage) => {
            if(m.receiver == this.myPeerId) {
                PeerService.peerMessageSubject.next(m);
            } else {
                let receiver = this.getPeer(m.receiver);
                receiver.getPeer().send(JSON.stringify(m));
            }
        })
    }

    private createPeer(peerToSignal: string, initiatorPeer: string): any {
        const peer = new Peer({
            initiator: true,
            trickle: false
        });

        peer.on("signal", (signal:any) => {
            this.socketService.send("sending_signal", { peerToSignal, initiatorPeer, signal })
        });

        peer.on("data", (data:any) => {
            PeerService.peerMessageSubject.next(this.getJSONPaxosMessage(data));
        });
        return peer;
    }

    private addPeer(incomingSignal: {}, peerID: string) {
        const peer = new Peer({
            initiator: false,
            trickle: false
        });

        peer.on("signal", (signal:any) => {
            this.socketService.send("returning_signal", { signal, peerID });
        });

        peer.signal(incomingSignal);

        peer.on('data', (data: any) => {
            PeerService.peerMessageSubject.next(this.getJSONPaxosMessage(data));
        });
        return peer;
    }

    public broadcastMessage(message: any): void {
        this.allPeers.forEach(p => {
            console.log(p.getPeer());
            p.getPeer().send(JSON.stringify({sender:this.myPeerId, message:{message:"Hello there"}}))
        });
    }

    public getMyPeerId():string {
        return this.myPeerId;
    }

    private getPeer(id:string):typeof Peer {
        return this.allPeers.find(p => p.getPeerId() == id);
    }

    public getMajority():number {
        return Math.ceil((this.allPeers.length + 1)/2);
    }

    public getClusterSize():number {
        return this.allPeers.length + 1;
    }

    private getJSONPaxosMessage(data: any): any {
        return JSON.parse(data.toString());
    }
}