const WebSocketServer = require("websocket").server;
const https = require("https");
const Express = require('express');
const path = require('path');
const fs = require('fs');
const app = Express();

app.use(Express.static(__dirname + '/public'));

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname + '/public/WalkieTalkie.html'));
})

const testServer = https.createServer({
    key:fs.readFileSync('walkieserver.key'),
    cert: fs.readFileSync('walkieserver.cert')},
    app).listen(2345, ()=>{
        console.log("LISTENING HTTPS!");
    })

//const testServer = app.listen(2345,"0.0.0.0",()=>{
//    console.log("Listening!");
//});

wsServer = new WebSocketServer({
    httpServer: testServer,
    autoAcceptConnections: false
});

var ClientList = [];

wsServer.on('request', function(req){
    console.log("connection requested");
    var conn = req.accept('walkietalkie', req.origin);
    ClientList.push(conn);
    conn.on('message',function(msg){
        if(msg.type === 'binary'){
            for(var c=0; c<ClientList.length; c++){
              if(ClientList[c] != conn){
                  ClientList[c].sendBytes(msg.binaryData);
              }  
            }
        }
        //console.log(msg);
    });
    conn.on('close',function(reason,desc){
        console.log("client disconnected");
    })
    
})
