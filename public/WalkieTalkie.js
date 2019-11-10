var audioCtx = undefined;
var audioBuff = null;
var scriptNode = null;
const BUFFSIZE = 1024;
var buffersource = null;
var mic = null;

var recording = false;

var recBuffer = [];
const recordBtn = document.querySelector("#rec");
const speaker = document.getElementById("speaker");

var ws = new WebSocket("wss://192.168.1.88:2345",'walkietalkie');
ws.binaryType = 'arraybuffer';
ws.onopen = function(e){
    ws.send("HELLO WORLD");
}


var NetBuff = null; 
var NetChanData = null;
var donePlaying = true;
ws.onmessage = function(e){
    if(donePlaying){
        var floatbuff = new Float32Array(e.data);
        if(NetBuff!==null){
            for(var ab=0; ab<floatbuff.length; ab++){
                NetChanData[ab] = floatbuff[ab];
            }
            buffersource = audioCtx.createBufferSource();
            buffersource.buffer = NetBuff
            buffersource.onended = ()=>{
                donePlaying = true;
                speaker.classList.remove("speaker-talking");
            }
            buffersource.connect(audioCtx.destination);
            donePlaying = false;
            speaker.classList.add("speaker-talking");
            buffersource.start();
        }
    }
}


function Record(){
  if(recording) return;
  recBuffer = [];
  if(audioCtx==undefined){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    NetBuff = audioCtx.createBuffer(1, BUFFSIZE, audioCtx.sampleRate);
    NetChanData = NetBuff.getChannelData(0);
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (s) {
            mic = audioCtx.createMediaStreamSource(s);
            scriptNode = audioCtx.createScriptProcessor(BUFFSIZE, 1, 1);
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
    if(mic !== null){
        if(buffersource!= null){
           buffersource.disconnect();
        }        
        mic.connect(scriptNode);
        scriptNode.connect(audioCtx.destination);
        recording =  true;
    }
}

function StopRecord(){
    if(mic!=null){
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


document.querySelector("#play").addEventListener("click", Playback);