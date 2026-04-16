const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let multiplier = 1.0;
let isCrashed = false;
let gameInterval;

function startGame() {
    multiplier = 1.0;
    isCrashed = false;
    io.emit('tick', { mult: multiplier.toFixed(2) });

    gameInterval = setInterval(() => {
        if (!isCrashed) {
            // ቁጥሩ እንዲጨምር የሚያደርግ ሎጂክ
            let increment = multiplier < 2 ? 0.01 : multiplier < 10 ? 0.05 : 0.1;
            multiplier += increment;
            io.emit('tick', { mult: multiplier.toFixed(2) });

            // በድንገት እንዲበላሽ (Crash) የማድረግ ዕድል
            if (Math.random() < 0.015) { 
                crashGame();
            }
        }
    }, 100);
}

function crashGame() {
    isCrashed = true;
    clearInterval(gameInterval);
    io.emit('crash', { point: multiplier.toFixed(2) });
    
    // ከ 5 ሰከንድ በኋላ አዲስ ጨዋታ ይጀምራል
    setTimeout(startGame, 5000);
}

startGame(); // ጨዋታውን ያስጀምሩ
server.listen(process.env.PORT || 3000, () => console.log("Server Running..."));
