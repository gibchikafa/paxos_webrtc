const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const botName = 'Server';

// Set static folder
//app.use(express.static(path.join(__dirname, 'public')));

let peersInCluster = [];
const numbers = Array(100).fill().map((_, index) => index + 1);

io.on("connection", socket => {
    io.emit("total_peers_in_cluster", {totalPeers: peersInCluster.length});
    socket.emit("my_peer_id", {myPeerId: socket.id});
    socket.on("join_cluster", id => {
        console.log(peersInCluster);
        if(!peersInCluster[socket.id]) {
            console.log(peersInCluster);
            peersInCluster.push(socket.id);
            var other_peers = peersInCluster.filter(p => p != socket.id);
            socket.emit("join_cluster", {peers:other_peers});
            io.emit("total_peers_in_cluster", {totalPeers: peersInCluster.length});
        }
    });

    socket.on("sending_signal", payload => {
        console.log(payload);
        io.to(payload.peerToSignal).emit('peer_joining', {signal: payload.signal, peerID: payload.initiatorPeer });
    });

    socket.on("returning_signal", payload => {
        console.log(payload);
        io.to(payload.peerID).emit('returned_signal', { signal: payload.signal, id: socket.id });
    });

    socket.on('disconnect', () => {
        let remainingPeers = peersInCluster.filter(id => id !== socket.id);
        peersInCluster = remainingPeers;
        io.emit("peer_disconnected", socket.id);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
