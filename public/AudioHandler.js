function AudioHandler()
{
    const me = this;
    me.audioCtx = null;
    me.audioBuff = null;
    me.scriptNode = null;
    me.BUFFSIZE = 4096;
    me.RX_SAMPLE_RATE = 8000;
    me.TX_SAMPLE_RATE = 48000;
    me.SUB_SAMPLE_RATE = 6;
    me.BufferSource = null;
    me.MediaStreamSource = null;
    me.recording = false;
    me.PlaybackAudioBuffer = null; 
    me.audioFinished = true;
    me.packetBuffer = [];
    me.subSampleIdx = 0;
    me.subSampleBuffer = new Int8Array(me.BUFFSIZE);
    me.Initialized = false;
    me.TxBufferFullCallback = null;
    me.RateAdjust = 1.0;

    me.createAudioContext = function(stream){
        me.MediaStreamSource = me.audioCtx.createMediaStreamSource(stream);
        me.BufferSource = me.audioCtx.createBufferSource();
        me.BufferSource.buffer = me.PlaybackAudioBuffer;
        me.BufferSource.connect(me.audioCtx.destination);
        me.BufferSource.start();
    }
    
    me.scriptProcessCallback = function(audioData){
        if(me.recording){
            me.SubSampleBuffer(audioData.inputBuffer.getChannelData(0));
        }
    };

    me.Initialize = function(initializedCB, erroCB){
        if(me.audioCtx===null){
            me.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            me.TX_SAMPLE_RATE = me.audioCtx.sampleRate;
            me.SUB_SAMPLE_RATE = Math.round(me.TX_SAMPLE_RATE/me.RX_SAMPLE_RATE);
            me.PlaybackAudioBuffer = me.audioCtx.createBuffer(1, me.BUFFSIZE, me.TX_SAMPLE_RATE);
            me.RateAdjust = me.RX_SAMPLE_RATE/me.TX_SAMPLE_RATE;
            var init = (s)=>{
                try{
                    me.createAudioContext(s);
                }
                catch(error){
                    erroCB("2: " + error);
                    return;
                }
                me.Initialized = true;
                if(initializedCB){ initializedCB(); }
            };
            
            var error = (e)=>{
                console.log('Darn something bad happened ' + e);
                if(erroCB){erroCB(e);}
            };
            
            if(navigator.mediaDevices.getUserMedia)
            {          
                navigator.mediaDevices
                        .getUserMedia({ audio: true }).then(init).catch(error);
            }
            else
            {
                var GetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                if(GetUserMedia)
                {
                    GetUserMedia({ audio: true },init, error);
                }
                else
                {
                    console.log("No User Media");
                    if(erroCB){erroCB("NO USERMEDIA");}
                }
            }           
        }
    }


    me.AudioFinishedPlaying = function(){
        me.audioFinished = true;
        me.BufferSource.disconnect(me.audioCtx.destination);
        me.ProcessBuffer(false);
    }

    me.PushToBuffer = function(packet){
        if(me.PlaybackAudioBuffer!==null){
            var floatbuff = new Int8Array(packet);
            me.packetBuffer.push(floatbuff);        
            me.ProcessBuffer(false);
        }
    }

    me.ProcessBuffer = function(processIfIncomplete){
        if(me.audioFinished && me.packetBuffer.length>0)
        {
            var netChanIdx=0;
            var channelDataBuffer = me.PlaybackAudioBuffer.getChannelData(0);
            var floatbuff = me.packetBuffer.shift();
            for(var ab=0; ab<floatbuff.length; ab++){
                channelDataBuffer[netChanIdx] = floatbuff[ab]/127;
                netChanIdx++;
            }
            me.BufferSource = me.audioCtx.createBufferSource();
            me.BufferSource.buffer = me.PlaybackAudioBuffer;
            me.BufferSource.onended = me.AudioFinishedPlaying;
            me.BufferSource.playbackRate.value = me.RateAdjust;
            me.audioFinished = false;
            me.BufferSource.connect(me.audioCtx.destination);
            me.BufferSource.start();
        }
    }

    me.SubSampleBuffer = function(buffer)
    {
        for(var b=0; b<me.BUFFSIZE; b+=me.SUB_SAMPLE_RATE){
            me.subSampleBuffer[me.subSampleIdx] = Math.round(buffer[b]*127);
            me.subSampleIdx++;
            if(me.subSampleIdx===me.BUFFSIZE){
                if(me.TxBufferFullCallback!==null)
                {
                    me.TxBufferFullCallback(me.subSampleBuffer);
                }
                me.subSampleIdx = 0;
            }
        }
    }

    me.StartRecord = function(){
        if(me.recording) return;
        me.subSampleIdx = 0;
        if(me.MediaStreamSource !== null){
            me.scriptNode = me.audioCtx.createScriptProcessor(me.BUFFSIZE, 1, 1);
            me.scriptNode.onaudioprocess = me.scriptProcessCallback;
            me.MediaStreamSource.connect(me.scriptNode);
            me.scriptNode.connect(me.audioCtx.destination);            
            me.recording =  true;
        }
    }

    me.StopRecord = function(){
        if(me.MediaStreamSource!=null){            
            me.recording = false;
            me.MediaStreamSource.disconnect(me.scriptNode);
            me.scriptNode.disconnect(me.audioCtx.destination);
            me.scriptNode.onaudioprocess = null;
            if(me.subSampleIdx !== 0){
                while(me.subSampleIdx < me.BUFFSIZE)
                {
                    me.subSampleBuffer[me.subSampleIdx] = 0;
                    me.subSampleIdx++;
                }
                if(me.TxBufferFullCallback!==null)
                {
                    me.TxBufferFullCallback(me.subSampleBuffer);
                }
                me.subSampleIdx = 0;
            }
        }
    }

    me.Close = function(){
        me.audioCtx.close();
        me.audioCtx = null;
    }

}







