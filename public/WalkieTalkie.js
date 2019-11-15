
const AudioController = new AudioHandler();
var receivingTx = false;
var poweredOn = false;
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
function StartRecord(){
    AudioController.StartRecord();
    msg["msg1"].textContent = "TX";
}
function StopRecord(){
    AudioController.StopRecord();
    msg["msg1"].textContent = "";
}
recordBtn.addEventListener("mousedown", StartRecord);
recordBtn.addEventListener("mouseup", StopRecord);
recordBtn.addEventListener("touchstart", StartRecord);
recordBtn.addEventListener("touchend", StopRecord);


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
                AudioController.DisconnectMicrophone();
                speaker.classList.add("speaker-talking");
            }
            else if(e.data==="OV" && receivingTx){
                msg["msg1"].textContent = "";
                receivingTx = false;
                speaker.classList.remove("speaker-talking");
                AudioController.ProcessBuffer(true);
            }
        }else{
            AudioController.PushToBuffer(e.data);
        }
    }
    AudioController.TxBufferFullCallback = (buffer)=>{ ws.send(buffer); }
}

function PowerOn(){
    if(!poweredOn){
        AudioController.Initialize(()=>{
            msg["msg3"].textContent = AudioController.RX_SAMPLE_RATE +":" + AudioController.TX_SAMPLE_RATE +":"+AudioController.SUB_SAMPLE_RATE;
            msg["msg2"].textContent = "Chan: " + CHANNEL_ID;
            CreateWebsocket();
            poweredOn = true;
        },
        (error)=>{
            msg["msg1"].textContent = error;
            msg["msg2"].textContent = "";
            msg["msg3"].textContent = "";
        });
        msg["msg2"].textContent = "Connecting...";
    }
    else{
        ws.close();
        AudioController.Close();
        msg["msg1"].textContent = "";
        msg["msg2"].textContent = "";
        msg["msg3"].textContent = "";        
        poweredOn = false;
    }
}
