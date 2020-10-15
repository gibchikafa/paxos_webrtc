export class PaxosPeer {
    private peerId:string;
    private peer: any;
    constructor(peerId:string, peer:any) {
        this.peerId = peerId;
        this.peer = peer;
    }

    public getPeerId():string {
        return this.peerId;
    }

    public getPeer(): any {
        return this.peer;
    }
}