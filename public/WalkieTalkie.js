var audioCtx = undefined;
var audioBuff = null;
var scriptNode = null;
const BUFFSIZE = 256;
const SAMPLE_SIZE = 8192;
var buffersource = null;
var mic = null;

var recording = false;

var recBuffer = [];
var NetBuff = null; 
var NetChanData = null;
var audioFinished = true;
var packetBuffer = [];
var receivingTx = false;

const recordBtn = document.getElementById("ptt");
const speaker = document.getElementById("speaker");
const msg = {
    msg1:document.getElementById("msg1"),
    msg2:document.getElementById("msg2"),
    msg3:document.getElementById("msg3"),
}
const powerBtn = document.getElementById("power");

const getLink = document.getElementById("getlink");
const link = document.getElementById("link");

getLink.addEventListener("click", ()=>{
  link.classList.add("copy");
  link.select();
  link.setSelectionRange(0, 99999); /*For mobile devices*/
  document.execCommand("copy");
  link.classList.remove("copy");
});

powerBtn.addEventListener("click", PowerOn);


window.oncontextmenu = function(event) {
     event.preventDefault();
     event.stopPropagation();
     return false;
};

var ws = null;

function CreateWebsocket(){
    ws = new WebSocket(WEBSOCKET_CHANNEL || "wss://192.168.1.88:2345",'walkietalkie');
    ws.binaryType = 'arraybuffer';
    ws.onopen = function(e){
        ws.send("HELLO WORLD");
    }
    ws.onmessage = function(e){
    if(typeof e.data === "string"){
            console.log("CMD:" + e.data);
            if(e.data==="TX"){
                msg["msg1"].textContent = "RX";
                receivingTx = true;
                mic.disconnect();
                scriptNode.disconnect();
                speaker.classList.add("speaker-talking");
            }
            else if(e.data==="OV" && receivingTx){
                msg["msg1"].textContent = "";
                receivingTx = false;
                speaker.classList.remove("speaker-talking");
                processBuffer();
            }
        }else{
            var floatbuff = new Float32Array(e.data);
            packetBuffer.push(floatbuff);
            if(NetBuff!==null){
                processBuffer();
            }
        }
    }
}


function audioFinishedCB(){
    audioFinished = true;
    processBuffer();
}

function processBuffer(){
    if(audioFinished && 
        (packetBuffer.length>7 || 
        (receivingTx===false && packetBuffer.length>0)))
    {
        var netChanIdx=0;
        for(var buffs=0; buffs<8; buffs++){
            if(packetBuffer.length>0){
                var floatbuff = packetBuffer.shift();
                for(var ab=0; ab<floatbuff.length; ab++){
                    NetChanData[netChanIdx] = floatbuff[ab];
                    netChanIdx++;
                }
            }
            else{
                for(var pad=0; pad<BUFFSIZE; pad++){
                    NetChanData[netChanIdx] = 0;
                    netChanIdx++;
                }
            }
        }
        buffersource = audioCtx.createBufferSource();
        buffersource.buffer = NetBuff;
        buffersource.onended = audioFinishedCB;
        audioFinished = false;
        buffersource.connect(audioCtx.destination);
        buffersource.start();
    }
}

function PowerOn(){
  if(audioCtx===undefined){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate:SAMPLE_SIZE});
    msg["msg3"].textContent = "Sample Rate: " + audioCtx.sampleRate +"Hz";
    msg["msg2"].textContent = "Chan: " + CHANNEL_ID;
    NetBuff = audioCtx.createBuffer(1, BUFFSIZE * 8, SAMPLE_SIZE);
    NetChanData = NetBuff.getChannelData(0);
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (s) {
            mic = audioCtx.createMediaStreamSource(s);
            scriptNode = audioCtx.createScriptProcessor(BUFFSIZE, 1, 1);
            buffersource = audioCtx.createBufferSource();
            buffersource.buffer = NetBuff;
            buffersource.connect(audioCtx.destination);
            buffersource.start();
            CreateWebsocket();
            
            scriptNode.onaudioprocess = function(audioData){
                if(recording){
                    var bytes = new Float32Array(audioData.inputBuffer.getChannelData(0));
                    ws.send(bytes);
                    recBuffer.push(bytes);
                }
            };
        })
        .catch(function (e) {
            console.log('Darn something bad happened ' + e);
        });
    }  
}

function Record(){
    if(recording) return;

    recBuffer = [];
    if(mic !== null){
        if(buffersource!== null){
           buffersource.disconnect();
        }
        mic.connect(scriptNode);
        scriptNode.connect(audioCtx.destination);
        msg["msg1"].textContent = "TX";
        ws.send("TX");
        recording =  true;
    }
}

function StopRecord(){
    if(mic!=null){
        msg["msg1"].textContent = "";
        ws.send("OV");
        recording = false;
        scriptNode.disconnect();
        mic.disconnect();
    }
}

function Playback(){
    var buff = audioCtx.createBuffer(1, recBuffer.length*BUFFSIZE, audioCtx.sampleRate);
    var chanData = buff.getChannelData(0);
    var tb = 0;
    for(var b=0; b<recBuffer.length;b++){
        for(var ab=0; ab<recBuffer[b].length; ab++){
            chanData[tb] = recBuffer[b][ab];
            tb++;
        }
    }
    buffersource = audioCtx.createBufferSource();
    buffersource.buffer = buff
    buffersource.connect(audioCtx.destination);
    buffersource.start();
    
    
}


recordBtn.addEventListener("mousedown", Record);
recordBtn.addEventListener("mouseup", StopRecord);

recordBtn.addEventListener("touchstart", Record);
recordBtn.addEventListener("touchend", StopRecord);


//document.querySelector("#play").addEventListener("click", Playback);