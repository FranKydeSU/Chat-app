const express = require('express')
const http = require('http')
const path = require('path')
const socketio = require('socket.io') // load socket.io library
const Filter = require('bad-words')
const { generateMessage, generateLocation } = require('./utils/message')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app) // refactoring for supporting socket.io
const io = socketio(server) // require socket function

const port = process.env.PORT || 3000

// Define paths for Express config
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

// server(emit) -> client(receive) --acknowledgement--> server
// client (emit) -> server(receive) --acknowledgement--> client

// socket.emit('', var) // for single connected client
// socket.broadcast.emit('', '')// for every single connected client *expect new single connected*
//      socket.boardcast.to().emit
// io.emit('', var) // for every single connected client
//      io.to().emit()

let message

io.on('connection', (socket) => { // <= socket: object of connection
    console.log('New websocket connected!')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room) // <= join the individual room

        socket.emit('message', generateMessage('System', 'Welcome'))
        socket.broadcast.to(user.room).emit('message', generateMessage('System', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })


        callback()
    })

    socket.on('sendMessage', (message, callback) => { // <= callback for event acknowledgements
        const user = getUser(socket.id)

        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocation(user.username, `https://www.google.com/maps/@${coords.latitude},${coords.longitude}`))
        callback('Location shared!')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('System', `${user.username} has lefted`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => { //
    console.log(`App listening at http://localhost:${port}`)
})