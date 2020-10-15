import {PaxosMessageIdentifier} from './PaxosMessageIdentifier'
/*
==============================================================================
Socket Messages
==============================================================================
*/
export interface SocketMessage {}

export interface JoinClusterSocketMessage extends SocketMessage {
    peers: string[]
}

export interface PeerJoiningSocketMessage extends SocketMessage {
    signal: any, 
    peerID: string
}

export interface TotalPeersInClusterMessage extends SocketMessage {
    totalPeers: number
}

export interface PeerDisconnectedMessage extends SocketMessage {
    peerID: string
}

export interface ReturnedSignalMessage extends SocketMessage {
    signal:any,
    id:string
}

export interface MyPeerIdMessage extends SocketMessage {
    myPeerId: string
}
//End socket messages

/*
==============================================================================
Paxos Message
==============================================================================
*/
export interface PaxosMessage {
    messageType:PaxosMessageIdentifier,
    sender:string,
    receiver:string
}

export interface ProposalMessage extends PaxosMessage {
    proposalNumber: ProposalNumber
}

export interface PromiseMessage extends PaxosMessage {
    proposalNumber:ProposalNumber,
    accetedProposal:AcceptedProposal
}

export interface AcceptMessageProposer extends PaxosMessage {
    proposalNumber:ProposalNumber,
    value:any
}

export interface AcceptMessageAcceptor extends PaxosMessage {
    proposalNumber:ProposalNumber
}

export interface DecideMessage extends PaxosMessage {
   value:any
}

export interface NackMessage extends PaxosMessage {
    proposalNumber:ProposalNumber
}

/*
==============================================================================
Paxos Variable Classes
==============================================================================
*/
export interface ProposalNumber {
    sequenceNumber:number,
    peerId:string
}

export interface AcceptedProposal {
    proposalNumber:ProposalNumber
    value:any
}

export interface PromisedProposal {
    proposalNumber: ProposalNumber
}

export interface HighestPromisedValue {
    proposalNumber:ProposalNumber,
    value:any
}
