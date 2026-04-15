const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '/')));

// የ 20% ትርፍ ሎጂክ
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // በየ 10 ሴኮንዱ አዲስ ዙር እንዲጀምር
    setInterval(() => {
        let crashPoint = Math.random() < 0.20 ? 1.00 : (1.05 + Math.random() * 4.0).toFixed(2);
        io.emit('crashData', { point: parseFloat(crashPoint) });
    }, 10000);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
