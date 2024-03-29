const usingNGINX = (process.env["USE_NGINX"]=="true");

const WebSocketServer = require("websocket").server;
const http = usingNGINX ? require("http") : require("https");
const Express = require('express');
const path = require('path');
const fs = require('fs');
const app = Express();


const ROOT = process.env["ROOT_ADDRESS"] || "127.0.0.1";
const PORT = process.env["PORT"] || 443;

console.log("PORT:" + PORT);
console.log("ROOT_ADDRESS:" + ROOT);

app.use(Express.static(__dirname + '/public'));
app.set('view engine', 'ejs'); 

app.get('/',(req,res)=>{
    //create random channel
    var chan = createChannelString();
    res.render("walkietalkie",{
        socketPath: "wss://"+ROOT+"/channel/" + chan,
        channelID: chan,
        link: "https://"+ROOT+"/channel/" + chan
    });
})

//Use the channelID to specify the "channel" of the radio
app.get('/channel/:channelID',(req,res)=>{
    res.render("walkietalkie",{
        socketPath: "wss://"+ROOT+"/channel/"+req.params.channelID,
        channelID: req.params.channelID,
        link: "https://"+ROOT+"/channel/" + req.params.channelID
    });
    
})

const webServer = usingNGINX ? 
    http.createServer(app).listen(PORT, "127.0.0.1", ()=>{
        console.log("LISTENING HTTPS!");
    }) :
    http.createServer({
        key:fs.readFileSync('walkieserver.key'),
        cert: fs.readFileSync('walkieserver.cert')},
        app).listen(PORT, "0.0.0.0", ()=>{
            console.log("LISTENING HTTPS!");
    });

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

const MAX_CHANNELS = 4000000000;

function createChannelString(){
    return Math.floor(Math.random() * MAX_CHANNELS).toString(36);
}

//Verify cross origin and all that nonsense
wsServer.on('request', function(req){
    var conn = req.accept('walkietalkie', req.origin);
    //Not Very Secure
    if(req.resource.startsWith("/channel/")){
        conn.ChannelID = req.resource;
    }
    else{
        conn.ChannelID = "/channel/"+createChannelString();
    }
    if(!(conn.ChannelID in ChannelMap) || ChannelMap[conn.ChannelID] === undefined){
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
        if(ChannelMap[conn.ChannelID].clientList.length===0){
            delete ChannelMap[conn.ChannelID];
        }
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
