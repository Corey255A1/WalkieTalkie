function AudioHandler()
{
    const me = this;
    me.audioCtx = null;
    me.audioBuff = null;
    me.scriptNode = null;
    me.BUFFSIZE = 256;
    me.RX_SAMPLE_RATE = 8000;
    me.TX_SAMPLE_RATE = 48000;
    me.SUB_SAMPLE_RATE = 44;
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
        me.scriptNode = me.audioCtx.createScriptProcessor(me.BUFFSIZE, 1, 1);
        me.BufferSource = me.audioCtx.createBufferSource();
        me.BufferSource.buffer = me.PlaybackAudioBuffer;
        me.BufferSource.connect(me.audioCtx.destination);
        me.BufferSource.start();                    
        me.scriptNode.onaudioprocess = function(audioData){
            if(me.recording){
                me.SubSampleBuffer(audioData.inputBuffer.getChannelData(0));
            }
        };
    }

    me.Initialize = function(initializedCB, erroCB){
        if(me.audioCtx===null){
            me.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            me.TX_SAMPLE_RATE = me.audioCtx.sampleRate;
            me.SUB_SAMPLE_RATE = Math.round(me.TX_SAMPLE_RATE/me.RX_SAMPLE_RATE);
            try{
                me.PlaybackAudioBuffer = me.audioCtx.createBuffer(1, me.BUFFSIZE * 8, me.RX_SAMPLE_RATE);
            }
            catch(error){
                me.PlaybackAudioBuffer = me.audioCtx.createBuffer(1, me.BUFFSIZE * 8, me.TX_SAMPLE_RATE);
                me.RateAdjust = me.RX_SAMPLE_RATE/me.TX_SAMPLE_RATE;
            }
            if(navigator.mediaDevices.getUserMedia)
            {          
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function (s) {
                    try{
                        me.createAudioContext(s);
                    }
                    catch(error){
                        erroCB("2: " + error);
                        return;
                    }
                    me.Initialized = true;
                    if(initializedCB){ initializedCB(); }
                })
                .catch(function (e) {
                    console.log('Darn something bad happened ' + e);
                    if(erroCB){erroCB(e);}
                });
            }
            else{
                var GetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                if(GetUserMedia)
                {
                    GetUserMedia({ audio: true },
                        function(s) {
                            me.createAudioContext(s);
                            me.Initialized = true;
                            if(initializedCB){ initializedCB(); }
                        },
                        function(e) {
                            console.log('Darn something bad happened ' + e);
                            if(erroCB){erroCB(e);}
                        }
                     );
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
        me.ProcessBuffer();
    }

    me.PushToBuffer = function(packet){
        if(me.PlaybackAudioBuffer!==null){
            var floatbuff = new Int8Array(packet);
            me.packetBuffer.push(floatbuff);        
            me.ProcessBuffer(false);
        }
    }

    me.DisconnectMicrophone = function(){
        me.MediaStreamSource.disconnect();
        me.scriptNode.disconnect();
    }

    me.ProcessBuffer = function(processIfIncomplete){
        if(me.audioFinished && 
            (me.packetBuffer.length>7 || 
            (processIfIncomplete && me.packetBuffer.length>0)))
        {
            var netChanIdx=0;
            var channelDataBuffer = me.PlaybackAudioBuffer.getChannelData(0);
            for(var buffs=0; buffs<8; buffs++){
                if(me.packetBuffer.length>0){
                    var floatbuff = me.packetBuffer.shift();
                    for(var ab=0; ab<floatbuff.length; ab++){
                        channelDataBuffer[netChanIdx] = floatbuff[ab]/127;
                        netChanIdx++;
                    }
                }
                else{
                    for(var pad=0; pad<me.BUFFSIZE; pad++){
                        channelDataBuffer[netChanIdx] = 0;
                        netChanIdx++;
                    }
                }
            }
            if(me.BufferSource!== null){
                me.BufferSource.disconnect();
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
                me.subSampleBuffer = new Int8Array(me.BUFFSIZE);
                me.subSampleIdx = 0;
            }
        }
    }

    me.StartRecord = function(){
        if(me.recording) return;
        me.subSampleIdx = 0;
        if(me.MediaStreamSource !== null){
            if(me.BufferSource!== null){
                me.BufferSource.disconnect();
            }
            me.MediaStreamSource.connect(me.scriptNode);
            me.scriptNode.connect(me.audioCtx.destination);            
            me.recording =  true;
        }
    }
    
    me.StopRecord = function(){
        if(me.MediaStreamSource!=null){            
            me.recording = false;
            me.MediaStreamSource.disconnect();
            me.scriptNode.disconnect();        
        }
    }

    me.Close = function(){
        me.audioCtx.close();
        me.audioCtx = null;
    }

}







