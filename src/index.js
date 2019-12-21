const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');

const {
  generateMessage,
  generateLocationMessage
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

io.on('connection', socket => {
  console.log('New web socket connection');

  socket.on('join', ({ username, room }, cb) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) return cb(error);

    socket.join(room);

    // This line emits the event to a specific connection
    socket.emit(
      'message',
      generateMessage({
        username: 'Admin',
        text: 'Welcome!'
      })
    );

    // Emits an event to all connections but the particular connection that is
    // emmiting the event
    // socket.broadcast.emit('message', generateMessage('A new user has joined!'));

    // This is a variation of socket.broadcast.emit, but it will emit an event
    // to all connections in an specific room, except the particular connection
    // that is emitting the event
    socket.broadcast.to(user.room).emit(
      'message',
      generateMessage({
        username: 'Admin',
        text: `${user.username} has joined!`
      })
    );

    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    });

    cb();
  });

  socket.on('sendMessage', ({ message }, cb) => {
    const user = getUser(socket.id);

    const filter = new Filter();

    if (filter.isProfane(message)) return cb('Profanity is not allowed!');

    // This line emits the event to all connections
    // io.emit('message', generateMessage(message));

    // This is similar io.emit, but it will emit an event to all connections in
    // a specific room, except the particular connection that is emitting the
    // event
    io.to(user.room).emit(
      'message',
      generateMessage({
        username: user.username,
        text: message
      })
    );

    cb();
  });

  socket.on('sendLocation', ({ lat, lng } = {}, cb) => {
    const user = getUser(socket.id);

    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage({
        username: user.username,
        url: `https://google.com/maps?q=${lat},${lng}`
      })
    );

    cb();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage({
          username: 'Admin',
          text: `${user.username} has left!`
        })
      );
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => console.log(`Server is up on port ${port}...`));
