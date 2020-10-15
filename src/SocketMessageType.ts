export enum SocketMessageType {
    JOIN_CLUSTER = "join_cluster",
    MY_PEER_ID = "my_peer_id",
    TOTAL_PEERS_IN_CLUSTER = "total_peers_in_cluster",
    PEER_JOINING = "peer_joining",
    PEER_DISCONNECTED = "peer_disconnected",
    RETURNED_SIGNAL = "returned_signal"
}