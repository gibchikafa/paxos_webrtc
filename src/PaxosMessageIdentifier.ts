export enum PaxosMessageIdentifier {
    //messages sent by proposer
    PREPARE_MESSAGE_IDENTIFIER_PROPOSER =  "proposer_prepare",
    ACCEPT_MESSAGE_IDENTIFIER_PROPOSER =  "proposer_accept",
    DECIDE_MESSAGE_IDENTIFIER = "decide",

    //messages sent by the acceptor
    PROMISE_MESSAGE_IDENTIFIER_ACCEPTOR = "acceptor_promise",
    ACCEPT_MESSAGE_IDENTIFIER_ACCEPTOR = "acceptor_accept",
    NACK_MESSAGE = "nack"
}