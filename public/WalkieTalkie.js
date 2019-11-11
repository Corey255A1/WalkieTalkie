var audioCtx = undefined;
var audioBuff = null;
var scriptNode = null;
const BUFFSIZE = 256;
const SAMPLE_SIZE = 8192;
var buffersource = null;
var mic = null;

var recording = false;

var recBuffer = [];
const recordBtn = document.querySelector("#rec");
const speaker = document.getElementById("speaker");

const msg = document.getElementById("msg");

window.oncontextmenu = function(event) {
     event.preventDefault();
     event.stopPropagation();
     return false;
};

var ws = new WebSocket("wss://192.168.1.88:2345",'walkietalkie');
ws.binaryType = 'arraybuffer';
ws.onopen = function(e){
    ws.send("HELLO WORLD");
}


var NetBuff = null; 
var NetChanData = null;
var donePlaying = true;
var packetBuffer = [];

function bufferDonePlaying(){
    if(packetBuffer.length>0){
        var floatbuff = packetBuffer.pop();
        for(var ab=0; ab<floatbuff.length; ab++){
            NetChanData[ab] = floatbuff[ab];
        }
        buffersource = audioCtx.createBufferSource();
        buffersource.buffer = NetBuff;
        buffersource.onended = bufferDonePlaying;
        
        buffersource.connect(audioCtx.destination);
        buffersource.start();
    }else{
        donePlaying = true;
        speaker.classList.remove("speaker-talking");
    }
}

ws.onmessage = function(e){
    if(typeof e.data === "string"){
        console.log("STRING MESSAGE " + e.data);
    }else{
        var floatbuff = new Float32Array(e.data);
        packetBuffer.push(floatbuff);
        if(donePlaying){
            if(NetBuff!==null){
                mic.disconnect();
                scriptNode.disconnect();
                donePlaying = false;
                speaker.classList.add("speaker-talking");
                bufferDonePlaying();
            }
        }
    }
}


function Record(){
  //msg.textContent = "TOUCH";
  if(recording) return;
  //msg.textContent = "Going";
  recBuffer = [];
  if(audioCtx===undefined){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({sampleRate:SAMPLE_SIZE});
    msg.textContent = "Audio Sample Rate: " + audioCtx.sampleRate +"Hz";
    NetBuff = audioCtx.createBuffer(1, BUFFSIZE, SAMPLE_SIZE);
    NetChanData = NetBuff.getChannelData(0);
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (s) {
            //msg.textContent = "CREATING SOURCE";
            mic = audioCtx.createMediaStreamSource(s);
            scriptNode = audioCtx.createScriptProcessor(BUFFSIZE, 1, 1);
            buffersource = audioCtx.createBufferSource();
            
            buffersource = audioCtx.createBufferSource();
            buffersource.buffer = NetBuff;
            buffersource.connect(audioCtx.destination);
            buffersource.start();
            
            
            scriptNode.onaudioprocess = function(audioData){
                //msg.textContent = "PROCESSING"
                if(recording){
                    //msg.textContent = "TX";
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
    //msg.textContent="MIC?"
    if(mic !== null){
        //msg.textContent = "NULL?"
        if(buffersource!== null){
           buffersource.disconnect();
        }
        //msg.textContent = "STARTING";
        mic.connect(scriptNode);
        scriptNode.connect(audioCtx.destination);
        recording =  true;
    }
}

function StopRecord(){
    if(mic!=null){
        //msg.textContent = "";
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