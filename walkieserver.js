const WebSocketServer = require("websocket").server;
const https = require("https");
const Express = require('express');
const path = require('path');
const fs = require('fs');
const app = Express();

app.use(Express.static(__dirname + '/public'));
app.set('view engine', 'ejs'); 

app.get('/',(req,res)=>{
    //res.sendFile(path.join(__dirname + '/public/WalkieTalkie.html'));
    res.render("walkietalkie",{
        socketPath: "wss://192.168.1.88:2345",
        channelID:"not specified"
    });
})

//Use hte channelID to specify the "channel" of the radio
app.get('/:channelID',(req,res)=>{
    console.log(req.params.channelID);
    //res.sendFile(path.join(__dirname + '/public/WalkieTalkie.html'));
    res.render("walkietalkie",{
        socketPath: "wss://192.168.1.88:2345/"+req.params.channelID,
        channelID: req.params.channelID
    });
    
})

const webServer = https.createServer({
    key:fs.readFileSync('walkieserver.key'),
    cert: fs.readFileSync('walkieserver.cert')},
    app).listen(process.env.PORT, "0.0.0.0", ()=>{
        console.log("LISTENING HTTPS!");
    })

wsServer = new WebSocketServer({
    httpServer: webServer,
    autoAcceptConnections: false
});


function createChannelEntry(){
    return {
        txClient:null,
        tick:0,
        clientList:[]};
}

//A Map of Channels and clients
var ChannelMap = {};

function StartTransmitting(chan, client)
{
    //tell everyone someone is transmitting
    if(chan.txClient === null)
    {
        chan.txClient = client;
        for(var c=0; c<chan.clientList.length; c++){
          if(chan.clientList[c] !== chan.txClient){
              chan.clientList[c].sendUTF("TX");
          }  
        }
    }
}
function StopTransmitting(chan)
{
    //Tell all clients on this channel, this user is done talking
    if(chan.txClient !== null)
    {
        for(var c=0; c<chan.clientList.length; c++)
        {
          if(chan.clientList[c] !== chan.txClient){
              chan.clientList[c].sendUTF("OV");
          }  
        }
        chan.txClient = null;
    }
}

function ProcessPacket(client, packet)
{
    var chan = ChannelMap[client.ChannelID];
    //Block if byte is not from current transmitter
    if(chan.txClient !== null && chan.txClient !== client) return;
    
    StartTransmitting(chan, client);
    for(var c=0; c<chan.clientList.length; c++)
    {
      if(chan.clientList[c] !== chan.txClient)
      {
          chan.clientList[c].sendBytes(packet);
      }  
    }
    chan.tick = 2;
}



wsServer.on('request', function(req){
    console.log("connection requested");
    var conn = req.accept('walkietalkie', req.origin);
    conn.ChannelID = req.resource;
    if(!(conn.ChannelID in ChannelMap)){
        ChannelMap[conn.ChannelID] = createChannelEntry();
    }
    ChannelMap[conn.ChannelID].clientList.push(conn);
    
    conn.sendUTF("HELLO");
    conn.on('message',function(msg){
        if(msg.type === 'binary'){
           ProcessPacket(conn, msg.binaryData); 
        }
    });
    conn.on('close',function(reason,desc){
        var idx = ChannelMap[conn.ChannelID].clientList.indexOf(conn);
        ChannelMap[conn.ChannelID].clientList.splice(idx, 1);
    })
    
})

//Set the Transmission Timeout
setInterval(()=>{
    for(var c in ChannelMap)
    {
        if(ChannelMap[c].tick===0)
        {
            StopTransmitting(ChannelMap[c]);
            
        }
        else
        {
            ChannelMap[c].tick--;
        }
    }
}, 500);
