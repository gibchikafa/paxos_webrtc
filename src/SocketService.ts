import * as io from 'socket.io-client';
import { SocketMessage,  MyPeerIdMessage} from './types';
import { SocketMessageType } from './SocketMessageType'
import { fromEvent, Observable } from 'rxjs';

export class SocketService {
    private static socket: SocketIOClient.Socket = {} as SocketIOClient.Socket;
    private static SIGNALING_SERVER:string = '192.168.1.140:3000';
    private static socketService:SocketService = null;

    public static getInstance():SocketService {
        if(SocketService.socketService == null) {
            if (Object.keys(SocketService.socket).length === 0) {
                SocketService.socket = io(this.SIGNALING_SERVER);
            }
            SocketService.socketService = new SocketService();
        }
        return SocketService.socketService;
    }

    //send a message for the server to broadcast
    public send(messageTag:string, message: any): void {
        SocketService.socket.emit(messageTag, message);
    }

    public onJoinMessage(): Observable<SocketMessage> {
        return fromEvent(SocketService.socket, SocketMessageType.JOIN_CLUSTER);
    }

    public onMyPeerId(): Observable<SocketMessage> {
        return fromEvent(SocketService.socket, SocketMessageType.MY_PEER_ID);
    }

    public onTotalPeersInCluster(): Observable<SocketMessage> {
        return fromEvent(SocketService.socket, SocketMessageType.TOTAL_PEERS_IN_CLUSTER);
    }

    public onPeerJoining(): Observable<SocketMessage> {
        return fromEvent(SocketService.socket, SocketMessageType.PEER_JOINING);
    }

    public onPeerDisconnected(): Observable<SocketMessage> {
        return fromEvent(SocketService.socket, SocketMessageType.PEER_DISCONNECTED);
    }

    public onReturnedSignal(): Observable<SocketMessage> {
        return fromEvent(SocketService.socket, SocketMessageType.RETURNED_SIGNAL);
    }
}