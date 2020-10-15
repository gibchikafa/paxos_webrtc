import { fromEvent, observable, Observable, Subject } from 'rxjs';
import { SocketService } from './SocketService'
import { generateRandomMessagesToCommit } from './MessageGenerator'
import { PeerService } from './PeerService'
import { PaxosMessageIdentifier } from './PaxosMessageIdentifier'
import * as MessageTypes from './types';

export class Paxos {
    public static paxosBroadCastMessageSubject = new Subject();
    public static paxosToPeerMessageSubject = new Subject();
    private messagesToCommit: string[];
    private socketService: SocketService;
    private peerService: PeerService;
    private myPeerId: string;
    public static canPropose = false;
    private commitMessageRequestSubject: any = null;

    //Proposer state
    private totalPromises = 0;
    private totalAccepts = 0;
    private highestPromiseWithValues: MessageTypes.HighestPromisedValue = { proposalNumber: { sequenceNumber: -1, peerId: "" }, value: "" };
    private totalReceivedPromises: number = 0;
    private totalReceivedAccepts: number = 0;
    private decided = true;
    private sequenceNumber = 0;
    private proposedValue = ""; //can change later
    private requestMessage = "" //original request message
    private receivedPromises: MessageTypes.HighestPromisedValue[] = []

    //Acceptor state
    private acceptedProposal: MessageTypes.AcceptedProposal = null;
    private promisedProposal: MessageTypes.PromisedProposal = { proposalNumber: { sequenceNumber: -1, peerId: "" } };

    constructor(peerService: PeerService, socketService: SocketService, messageRequestSubject: any) {
        this.peerService = peerService;
        this.socketService = socketService;
        this.messagesToCommit = generateRandomMessagesToCommit();
        this.commitMessageRequestSubject = messageRequestSubject;
        let initialPaxosLog: any = { "log": [] };
        localStorage.setItem("paxosLog", JSON.stringify(initialPaxosLog));
    }

    public startPaxos(): void {
        let onMyPeerIdObservable = this.socketService.onMyPeerId();
        onMyPeerIdObservable.subscribe((m: MessageTypes.MyPeerIdMessage) => {
            this.myPeerId = m.myPeerId;
        })

        let paxosMessageSubscriber = PeerService.peerMessageSubject;
        paxosMessageSubscriber.subscribe((message: any) => {
            //We have received a paxos message
            //console.log(message);
            let paxosMessage = this.getJSONPaxosMessage(message);
            let messageType = paxosMessage.messageType;
            if (messageType == PaxosMessageIdentifier.PREPARE_MESSAGE_IDENTIFIER_PROPOSER) {
                //handle prepare message on acceptor
                //this.handlePrepare(paxosMessage);
                let prepareMessage: MessageTypes.PromiseMessage = message;
                if (this.greaterThan(prepareMessage.proposalNumber, this.promisedProposal.proposalNumber)) {
                    this.promisedProposal.proposalNumber = prepareMessage.proposalNumber
                    var promiseResponse: MessageTypes.PromiseMessage = {
                        messageType: PaxosMessageIdentifier.PROMISE_MESSAGE_IDENTIFIER_ACCEPTOR,
                        proposalNumber: prepareMessage.proposalNumber, sender: this.myPeerId, accetedProposal: null, receiver: prepareMessage.sender
                    };
                    if (this.acceptedProposal !== null) {
                        promiseResponse.accetedProposal = this.acceptedProposal;
                    }
                    Paxos.paxosToPeerMessageSubject.next(promiseResponse);
                } else {
                    let nackMessage: MessageTypes.NackMessage = {
                        messageType: PaxosMessageIdentifier.NACK_MESSAGE, sender: this.myPeerId,
                        receiver: prepareMessage.sender, proposalNumber: prepareMessage.proposalNumber
                    }
                    Paxos.paxosToPeerMessageSubject.next(nackMessage);
                }
            } else if (messageType == PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_PROPOSER) {
                //handle accept message on accept
                //this.handleAccept(paxosMessage);
                let acceptMessage: MessageTypes.AcceptMessageProposer = message;
                if (this.greaterThanOrEqualTo(acceptMessage.proposalNumber, this.promisedProposal.proposalNumber)) {
                    this.promisedProposal = { proposalNumber: acceptMessage.proposalNumber };
                    this.acceptedProposal = { proposalNumber: acceptMessage.proposalNumber, value: acceptMessage.value };
                    var messageToSend: MessageTypes.AcceptMessageAcceptor = {
                        messageType: PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_ACCEPTOR,
                        sender: this.myPeerId, receiver: acceptMessage.sender, proposalNumber: acceptMessage.proposalNumber
                    };
                    Paxos.paxosToPeerMessageSubject.next(messageToSend);
                } else {
                    let nackMessage: MessageTypes.NackMessage = {
                        messageType: PaxosMessageIdentifier.NACK_MESSAGE, sender: this.myPeerId,
                        receiver: acceptMessage.sender, proposalNumber: acceptMessage.proposalNumber
                    };
                    Paxos.paxosToPeerMessageSubject.next(nackMessage);
                }
            } else if (messageType == PaxosMessageIdentifier.DECIDE_MESSAGE_IDENTIFIER) {
                //handle recieve message
                //this.recieveDecide(paxosMessage);
                let decideMessage: MessageTypes.DecideMessage = message;
                console.log(decideMessage);
                if (decideMessage.sender == this.myPeerId) {
                    Paxos.canPropose = true;
                }
                var paxosLogTemp = JSON.parse(localStorage.getItem("paxosLog"));
                //console.log(paxosLogTemp);
                paxosLogTemp["log"].push(decideMessage.value);
                localStorage.setItem("paxosLog", JSON.stringify(paxosLogTemp));
            } else if (messageType == PaxosMessageIdentifier.PROMISE_MESSAGE_IDENTIFIER_ACCEPTOR) {
                //handle promise on acceptor
                //this.recievePromises(paxosMessage);
                //To avoid late messages
                //console.log(promiseMessage);
                let promiseMessage: MessageTypes.PromiseMessage = message;
                if (promiseMessage.proposalNumber.sequenceNumber == this.sequenceNumber) {
                    this.totalReceivedPromises++;
                    this.receivedPromises.push(promiseMessage.accetedProposal);
                    if (promiseMessage.messageType == PaxosMessageIdentifier.PROMISE_MESSAGE_IDENTIFIER_ACCEPTOR) {
                        this.totalPromises++;
                        if (promiseMessage.accetedProposal !== null) {
                            if (this.greaterThanOrEqualTo(promiseMessage.accetedProposal.proposalNumber, this.highestPromiseWithValues.proposalNumber)) {
                                //already accepted
                                this.highestPromiseWithValues.proposalNumber = promiseMessage.accetedProposal.proposalNumber;
                            }
                        }
                    }

                    if (this.totalReceivedPromises >= this.peerService.getClusterSize()) {
                        //console.log(this.receivedPromises);
                        if (this.totalPromises >= this.peerService.getMajority()) {
                            if (this.highestPromiseWithValues.value != "") {
                                this.proposedValue = this.highestPromiseWithValues.value;
                            }
                            //start accept phase
                            var acceptMessage: MessageTypes.AcceptMessageProposer = {
                                sender: this.myPeerId, receiver: "all", messageType: PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_PROPOSER,
                                proposalNumber: { sequenceNumber: this.sequenceNumber, peerId: this.myPeerId }, value: this.proposedValue
                            };
                            Paxos.paxosBroadCastMessageSubject.next(acceptMessage);
                        } else {
                            this.initiatePrepare(this.requestMessage);
                        }
                    }
                }
            } else if (messageType == PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_ACCEPTOR) {
                //handle accept on acceptor
                //this.receiveAcceptMessages(paxosMessage);
                let acceptorAcceptMessage: MessageTypes.AcceptMessageAcceptor = message;
                if (acceptorAcceptMessage.proposalNumber.sequenceNumber == this.sequenceNumber) {
                    this.totalReceivedAccepts++;
                    if (acceptorAcceptMessage.messageType == PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_ACCEPTOR) {
                        this.totalAccepts++;
                    }

                    if (this.totalReceivedAccepts >= this.peerService.getClusterSize()) {
                        if (this.totalAccepts >= this.peerService.getMajority()) {
                            //send decide messages
                            let decideMessage: MessageTypes.DecideMessage = {
                                messageType: PaxosMessageIdentifier.DECIDE_MESSAGE_IDENTIFIER,
                                sender: this.myPeerId, receiver: "all", value: this.proposedValue
                            }
                            Paxos.paxosBroadCastMessageSubject.next(decideMessage);
                        } else {
                            this.initiatePrepare(this.requestMessage);
                        }
                    }
                }
            } else if (messageType == PaxosMessageIdentifier.NACK_MESSAGE) {
                //handle nack message proposer
                //this.receiveNack(paxosMessage);
                console.log(message);
                let nackMessage: MessageTypes.NackMessage = message;
                if (nackMessage.proposalNumber.sequenceNumber == this.sequenceNumber) {
                    //reset state variables
                    this.totalPromises = 0;
                    this.totalAccepts = 0;
                    this.highestPromiseWithValues = { proposalNumber: { sequenceNumber: -1, peerId: "" }, value: "" };
                    this.proposedValue = message;
                    this.requestMessage = message;
                    this.receivedPromises = [];
                    this.monotonic();
                    let proposalToSend: MessageTypes.ProposalMessage = {
                        sender: this.myPeerId, receiver: "all",
                        messageType: PaxosMessageIdentifier.PREPARE_MESSAGE_IDENTIFIER_PROPOSER,
                        proposalNumber: { sequenceNumber: this.sequenceNumber, peerId: this.myPeerId }
                    };
                    Paxos.paxosBroadCastMessageSubject.next(proposalToSend);
                }
            }
        });

        let clusterPeersEnough = PeerService.clusterPeersEnough;
        clusterPeersEnough.subscribe((message: boolean) => {
            Paxos.canPropose = true;
        });

        this.commitMessageRequestSubject.subscribe((message: any) => {
            if (Paxos.canPropose) {
                Paxos.canPropose = false;
                this.requestMessage = message;
                //reset state variables
                this.totalPromises = 0;
                this.totalAccepts = 0;
                this.highestPromiseWithValues = { proposalNumber: { sequenceNumber: -1, peerId: "" }, value: "" };
                this.proposedValue = message;
                this.requestMessage = message;
                this.receivedPromises = [];
                this.monotonic();
                let proposalToSend: MessageTypes.ProposalMessage = {
                    sender: this.myPeerId, receiver: "all",
                    messageType: PaxosMessageIdentifier.PREPARE_MESSAGE_IDENTIFIER_PROPOSER,
                    proposalNumber: { sequenceNumber: this.sequenceNumber, peerId: this.myPeerId }
                };
                Paxos.paxosBroadCastMessageSubject.next(proposalToSend);
            }
        });
    }

    private receiveNack(nackMessage: MessageTypes.NackMessage) {
        if (nackMessage.proposalNumber.sequenceNumber == this.sequenceNumber) {
            this.initiatePrepare(this.requestMessage);
        }
    }

    //The proposer is receiveing accept messages from acceptors
    private receiveAcceptMessages(acceptorAcceptMessage: MessageTypes.AcceptMessageAcceptor) {
        if (acceptorAcceptMessage.proposalNumber.sequenceNumber == this.sequenceNumber) {
            this.totalReceivedAccepts++;
            if (acceptorAcceptMessage.messageType == PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_ACCEPTOR) {
                this.totalAccepts++;
            }

            if (this.totalReceivedAccepts >= this.peerService.getClusterSize()) {
                if (this.totalAccepts >= this.peerService.getMajority()) {
                    //send decide messages
                    let decideMessage: MessageTypes.DecideMessage = {
                        messageType: PaxosMessageIdentifier.DECIDE_MESSAGE_IDENTIFIER,
                        sender: this.myPeerId, receiver: "all", value: this.proposedValue
                    }
                    Paxos.paxosBroadCastMessageSubject.next(decideMessage);
                } else {
                    this.initiatePrepare(this.requestMessage);
                }
            }
        }
    }

    //Initiate prepare messages
    private initiatePrepare(message: any): void {
        //reset state variables
        this.totalPromises = 0;
        this.totalAccepts = 0;
        this.highestPromiseWithValues = { proposalNumber: { sequenceNumber: -1, peerId: "" }, value: "" };
        this.proposedValue = message;
        this.requestMessage = message;
        this.receivedPromises = [];
        this.monotonic();
        let proposalToSend: MessageTypes.ProposalMessage = {
            sender: this.myPeerId, receiver: "all",
            messageType: PaxosMessageIdentifier.PREPARE_MESSAGE_IDENTIFIER_PROPOSER,
            proposalNumber: { sequenceNumber: this.sequenceNumber, peerId: this.myPeerId }
        };
        Paxos.paxosBroadCastMessageSubject.next(proposalToSend);
    }

    //The proposer has received a promise
    private recievePromises(promiseMessage: MessageTypes.PromiseMessage) {
        //To avoid late messages
        //console.log(promiseMessage);
        if (promiseMessage.proposalNumber.sequenceNumber == this.sequenceNumber) {
            this.totalReceivedPromises++;
            this.receivedPromises.push(promiseMessage.accetedProposal);
            if (promiseMessage.messageType == PaxosMessageIdentifier.PROMISE_MESSAGE_IDENTIFIER_ACCEPTOR) {
                this.totalPromises++;
                if (promiseMessage.accetedProposal !== null) {
                    if (this.greaterThanOrEqualTo(promiseMessage.accetedProposal.proposalNumber, this.highestPromiseWithValues.proposalNumber)) {
                        //already accepted
                        this.highestPromiseWithValues.proposalNumber = promiseMessage.accetedProposal.proposalNumber;
                    }
                }
            }

            if (this.totalReceivedPromises >= this.peerService.getClusterSize()) {
                //console.log(this.receivedPromises);
                if (this.totalPromises >= this.peerService.getMajority()) {
                    if (this.highestPromiseWithValues.value != "") {
                        this.proposedValue = this.highestPromiseWithValues.value;
                    }
                    //start accept phase
                    var acceptMessage: MessageTypes.AcceptMessageProposer = {
                        sender: this.myPeerId, receiver: "all", messageType: PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_PROPOSER,
                        proposalNumber: { sequenceNumber: this.sequenceNumber, peerId: this.myPeerId }, value: this.proposedValue
                    };
                    Paxos.paxosBroadCastMessageSubject.next(acceptMessage);
                } else {
                    this.initiatePrepare(this.requestMessage);
                }
            }
        }
    }

    //We have received a decide message
    private recieveDecide(decideMessage: MessageTypes.DecideMessage) {
        console.log(decideMessage);
        if (decideMessage.sender == this.myPeerId) {
            Paxos.canPropose = true;
        }
        var paxosLogTemp = JSON.parse(localStorage.getItem("paxosLog"));
        //console.log(paxosLogTemp);
        paxosLogTemp["log"].push(decideMessage.value);
        localStorage.setItem("paxosLog", JSON.stringify(paxosLogTemp));
    }

    //The acceptor has recived accept message
    private handleAccept(acceptMessage: MessageTypes.AcceptMessageProposer) {
        if (this.greaterThanOrEqualTo(acceptMessage.proposalNumber, this.promisedProposal.proposalNumber)) {
            this.promisedProposal = { proposalNumber: acceptMessage.proposalNumber };
            this.acceptedProposal = { proposalNumber: acceptMessage.proposalNumber, value: acceptMessage.value };
            var messageToSend: MessageTypes.AcceptMessageAcceptor = {
                messageType: PaxosMessageIdentifier.ACCEPT_MESSAGE_IDENTIFIER_ACCEPTOR,
                sender: this.myPeerId, receiver: acceptMessage.sender, proposalNumber: acceptMessage.proposalNumber
            };
            Paxos.paxosToPeerMessageSubject.next(messageToSend);
        } else {
            let nackMessage: MessageTypes.NackMessage = {
                messageType: PaxosMessageIdentifier.NACK_MESSAGE, sender: this.myPeerId,
                receiver: acceptMessage.sender, proposalNumber: acceptMessage.proposalNumber
            };
            Paxos.paxosToPeerMessageSubject.next(nackMessage);
        }
    }

    //Acceptor method. 
    //Handles the prepare message sent by the proposer
    private handlePrepare(prepareMessage: MessageTypes.ProposalMessage) {
        if (this.greaterThan(prepareMessage.proposalNumber, this.promisedProposal.proposalNumber)) {
            this.promisedProposal.proposalNumber = prepareMessage.proposalNumber
            var promiseResponse: MessageTypes.PromiseMessage = {
                messageType: PaxosMessageIdentifier.PROMISE_MESSAGE_IDENTIFIER_ACCEPTOR,
                proposalNumber: prepareMessage.proposalNumber, sender: this.myPeerId, accetedProposal: null, receiver: prepareMessage.sender
            };
            if (this.acceptedProposal !== null) {
                promiseResponse.accetedProposal = this.acceptedProposal;
            }
            Paxos.paxosToPeerMessageSubject.next(promiseResponse);
        } else {
            let nackMessage: MessageTypes.NackMessage = {
                messageType: PaxosMessageIdentifier.NACK_MESSAGE, sender: this.myPeerId,
                receiver: prepareMessage.sender, proposalNumber: prepareMessage.proposalNumber
            }
            Paxos.paxosToPeerMessageSubject.next(nackMessage);
        }
    }

    private getJSONPaxosMessage(data: any): any {
        return data;
    }

    private monotonic(): void {
        this.sequenceNumber++;
    }

    //Compares the proposal numbers
    private greaterThanOrEqualTo(newProposal: MessageTypes.ProposalNumber, currentProposal: MessageTypes.ProposalNumber): boolean {
        if (newProposal.sequenceNumber > currentProposal.sequenceNumber) {
            return true;
        } else if (newProposal.sequenceNumber == currentProposal.sequenceNumber && newProposal.peerId > currentProposal.peerId) {
            return true;
        } else if (newProposal.sequenceNumber == currentProposal.sequenceNumber && newProposal.peerId == currentProposal.peerId) {
            return true;
        } else {
            return false;
        }
    }

    //Compares the proposal numbers
    private greaterThan(newProposal: MessageTypes.ProposalNumber, currentProposal: MessageTypes.ProposalNumber): boolean {
        if (newProposal.sequenceNumber > currentProposal.sequenceNumber) {
            return true;
        } else if (newProposal.sequenceNumber == currentProposal.sequenceNumber && newProposal.peerId > currentProposal.peerId) {
            return true;
        } else {
            return false;
        }
    }
}