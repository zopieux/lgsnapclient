"use strict";
class Tv {
  constructor(sec, usec) {
    this.sec = 0;
    this.usec = 0;
    this.sec = sec;
    this.usec = usec;
  }
  setMilliseconds(ms) {
    this.sec = Math.floor(ms / 1000);
    this.usec = Math.floor(ms * 1000) % 1000000;
  }
  getMilliseconds() {
    return this.sec * 1000 + this.usec / 1000;
  }
}
class BaseMessage {
  constructor(buffer) {
    this.type = 0;
    this.id = 0;
    this.refersTo = 0;
    this.received = new Tv(0, 0);
    this.sent = new Tv(0, 0);
    this.size = 0;
  }
  deserialize(buffer) {
    let view = new DataView(buffer);
    this.type = view.getUint16(0, true);
    this.id = view.getUint16(2, true);
    this.refersTo = view.getUint16(4, true);
    this.received = new Tv(view.getInt32(6, true), view.getInt32(10, true));
    this.sent = new Tv(view.getInt32(14, true), view.getInt32(18, true));
    this.size = view.getUint32(22, true);
  }
  serialize() {
    this.size = 26 + this.getSize();
    let buffer = new ArrayBuffer(this.size);
    let view = new DataView(buffer);
    view.setUint16(0, this.type, true);
    view.setUint16(2, this.id, true);
    view.setUint16(4, this.refersTo, true);
    view.setInt32(6, this.sent.sec, true);
    view.setInt32(10, this.sent.usec, true);
    view.setInt32(14, this.received.sec, true);
    view.setInt32(18, this.received.usec, true);
    view.setUint32(22, this.size, true);
    return buffer;
  }
  getSize() {
    return 0;
  }
}
class CodecMessage extends BaseMessage {
  constructor(buffer) {
    super(buffer);
    this.codec = "";
    this.payload = new ArrayBuffer(0);
    if (buffer) {
      this.deserialize(buffer);
    }
    this.type = 1;
  }
  deserialize(buffer) {
    super.deserialize(buffer);
    let view = new DataView(buffer);
    let codecSize = view.getInt32(26, true);
    let decoder = new TextDecoder("utf-8");
    this.codec = decoder.decode(buffer.slice(30, 30 + codecSize));
    let payloadSize = view.getInt32(30 + codecSize, true);
    this.payload = buffer.slice(34 + codecSize, 34 + codecSize + payloadSize);
  }
}
class TimeMessage extends BaseMessage {
  constructor(buffer) {
    super(buffer);
    this.latency = new Tv(0, 0);
    if (buffer) {
      this.deserialize(buffer);
    }
    this.type = 4;
  }
  deserialize(buffer) {
    super.deserialize(buffer);
    let view = new DataView(buffer);
    this.latency = new Tv(view.getInt32(26, true), view.getInt32(30, true));
  }
  serialize() {
    let buffer = super.serialize();
    let view = new DataView(buffer);
    view.setInt32(26, this.latency.sec, true);
    view.setInt32(30, this.latency.sec, true);
    return buffer;
  }
  getSize() {
    return 8;
  }
}
class JsonMessage extends BaseMessage {
  constructor(buffer) {
    super(buffer);
    if (buffer) {
      this.deserialize(buffer);
    }
  }
  deserialize(buffer) {
    super.deserialize(buffer);
    let view = new DataView(buffer);
    let size = view.getInt32(26, true);
    let decoder = new TextDecoder();
    this.json = JSON.parse(decoder.decode(buffer.slice(30)));
  }
  serialize() {
    let buffer = super.serialize();
    let view = new DataView(buffer);
    let jsonStr = JSON.stringify(this.json);
    view.setUint32(26, jsonStr.length, true);
    let encoder = new TextEncoder();
    let encoded = encoder.encode(jsonStr);
    for (let i = 0; i < encoded.length; ++i)
      view.setUint8(30 + i, encoded[i]);
    return buffer;
  }
  getSize() {
    let encoder = new TextEncoder();
    let encoded = encoder.encode(JSON.stringify(this.json));
    return encoded.length + 4;
  }
}
class HelloMessage extends JsonMessage {
  constructor(buffer) {
    super(buffer);
    this.mac = "";
    this.hostname = "";
    this.version = "0.1.0";
    this.clientName = "Snapweb";
    this.os = "";
    this.arch = "web";
    this.instance = 1;
    this.uniqueId = "";
    this.snapStreamProtocolVersion = 2;
    if (buffer) {
      this.deserialize(buffer);
    }
    this.type = 5;
  }
  deserialize(buffer) {
    super.deserialize(buffer);
    this.mac = this.json["MAC"];
    this.hostname = this.json["HostName"];
    this.version = this.json["Version"];
    this.clientName = this.json["ClientName"];
    this.os = this.json["OS"];
    this.arch = this.json["Arch"];
    this.instance = this.json["Instance"];
    this.uniqueId = this.json["ID"];
    this.snapStreamProtocolVersion = this.json["SnapStreamProtocolVersion"];
  }
  serialize() {
    this.json = { "MAC": this.mac, "HostName": this.hostname, "Version": this.version, "ClientName": this.clientName, "OS": this.os, "Arch": this.arch, "Instance": this.instance, "ID": this.uniqueId, "SnapStreamProtocolVersion": this.snapStreamProtocolVersion };
    return super.serialize();
  }
}
class ServerSettingsMessage extends JsonMessage {
  constructor(buffer) {
    super(buffer);
    this.bufferMs = 0;
    this.latency = 250;
    this.volumePercent = 0;
    this.muted = false;
    if (buffer) {
      this.deserialize(buffer);
    }
    this.type = 3;
  }
  deserialize(buffer) {
    super.deserialize(buffer);
    this.bufferMs = this.json["bufferMs"];
    this.latency = this.json["latency"];
    this.volumePercent = this.json["volume"];
    this.muted = this.json["muted"];
  }
  serialize() {
    this.json = { "bufferMs": this.bufferMs, "latency": this.latency, "volume": this.volumePercent, "muted": this.muted };
    return super.serialize();
  }
}
class PcmChunkMessage extends BaseMessage {
  constructor(buffer, sampleFormat) {
    super(buffer);
    this.timestamp = new Tv(0, 0);
    this.payload = new ArrayBuffer(0);
    this.idx = 0;
    this.deserialize(buffer);
    this.sampleFormat = sampleFormat;
    this.type = 2;
  }
  deserialize(buffer) {
    super.deserialize(buffer);
    let view = new DataView(buffer);
    this.timestamp = new Tv(view.getInt32(26, true), view.getInt32(30, true));
    this.payload = buffer.slice(38); //, this.payloadSize + 38));// , this.payloadSize);
  }
  readFrames(frames) {
    let frameCnt = frames;
    let frameSize = this.sampleFormat.frameSize();
    if (this.idx + frames > this.payloadSize() / frameSize)
      frameCnt = (this.payloadSize() / frameSize) - this.idx;
    let begin = this.idx * frameSize;
    this.idx += frameCnt;
    let end = begin + frameCnt * frameSize;
    return this.payload.slice(begin, end);
  }
  getFrameCount() {
    return (this.payloadSize() / this.sampleFormat.frameSize());
  }
  isEndOfChunk() {
    return this.idx >= this.getFrameCount();
  }
  startMs() {
    return this.timestamp.getMilliseconds() + 1000 * (this.idx / this.sampleFormat.rate);
  }
  duration() {
    return 1000 * ((this.getFrameCount() - this.idx) / this.sampleFormat.rate);
  }
  payloadSize() {
    return this.payload.byteLength;
  }
  clearPayload() {
    this.payload = new ArrayBuffer(0);
  }
  addPayload(buffer) {
    let payload = new ArrayBuffer(this.payload.byteLength + buffer.byteLength);
    let view = new DataView(payload);
    let viewOld = new DataView(this.payload);
    let viewNew = new DataView(buffer);
    for (let i = 0; i < viewOld.byteLength; ++i) {
      view.setInt8(i, viewOld.getInt8(i));
    }
    for (let i = 0; i < viewNew.byteLength; ++i) {
      view.setInt8(i + viewOld.byteLength, viewNew.getInt8(i));
    }
    this.payload = payload;
  }
}
class AudioStream {
  constructor(timeProvider, sampleFormat, bufferMs) {
    this.timeProvider = timeProvider;
    this.sampleFormat = sampleFormat;
    this.bufferMs = bufferMs;
    this.chunks = new Array();
    this.chunk = undefined;
    this.volume = 1;
    this.muted = false;
    this.lastLog = 0;
  }
  setVolume(percent, muted) {
    this.volume = percent / 100;
    console.log("setVolume: " + percent + " => " + this.volume + ", muted: " + this.muted);
    this.muted = muted;
  }
  addChunk(chunk) {
    this.chunks.push(chunk);
    while (this.chunks.length > 0) {
      let age = this.timeProvider.serverNow() - this.chunks[0].timestamp.getMilliseconds();
      // todo: consider buffer ms
      if (age > 5000 + this.bufferMs) {
        this.chunks.shift();
        console.log("Dropping old chunk: " + age.toFixed(2) + ", left: " + this.chunks.length);
      }
      else
        break;
    }
  }
  getNextBuffer(buffer, playTimeMs) {
    if (!this.chunk) {
      this.chunk = this.chunks.shift();
    }
    let frames = buffer.length;
    let left = new Float32Array(frames);
    let right = new Float32Array(frames);
    let read = 0;
    let pos = 0;
    let serverPlayTimeMs = this.timeProvider.serverTime(playTimeMs);
    if (this.chunk) {
      let age = serverPlayTimeMs - this.chunk.startMs(); // - 500;
      let reqChunkDuration = frames / this.sampleFormat.msRate();
      let secs = Math.floor(Date.now() / 1000);
      if (this.lastLog != secs) {
        this.lastLog = secs;
        console.debug("age: " + age.toFixed(2) + ", req: " + reqChunkDuration);
      }
      if (age < -reqChunkDuration) {
        console.debug("age: " + age.toFixed(2) + " < req: " + reqChunkDuration * -1 + ", chunk.startMs: " + this.chunk.startMs().toFixed(2) + ", timestamp: " + this.chunk.timestamp.getMilliseconds().toFixed(2));
        console.debug("Chunk too young, returning silence");
      }
      else {
        if (Math.abs(age) > 5) {
          // We are 5ms apart, do a hard sync, i.e. don't play faster/slower, 
          // but seek to the desired position instead
          while (this.chunk && age > this.chunk.duration()) {
            console.debug("Chunk too old, dropping (age: " + age.toFixed(2) + " > " + this.chunk.duration().toFixed(2) + ")");
            this.chunk = this.chunks.shift();
            if (!this.chunk)
              break;
            age = serverPlayTimeMs - this.chunk.startMs();
          }
          if (this.chunk) {
            if (age > 0) {
              console.debug("Fast forwarding " + age.toFixed(2) + "ms");
              this.chunk.readFrames(Math.floor(age * this.chunk.sampleFormat.msRate()));
            }
            else if (age < 0) {
              console.debug("Playing silence " + -age.toFixed(2) + "ms");
              let silentFrames = Math.floor(-age * this.chunk.sampleFormat.msRate());
              left.fill(0, 0, silentFrames);
              right.fill(0, 0, silentFrames);
              read = silentFrames;
              pos = silentFrames;
            }
            age = 0;
          }
        }
        let addFrames = 0;
        let everyN = 0;
        if (age > 0.1) {
          addFrames = Math.ceil(age);
        }
        else if (age < -0.1) {
          addFrames = Math.floor(age);
        }
        let readFrames = frames + addFrames - read;
        if (addFrames != 0)
          everyN = Math.ceil((frames + addFrames - read) / (Math.abs(addFrames) + 1));
        while ((read < readFrames) && this.chunk) {
          let pcmChunk = this.chunk;
          let pcmBuffer = pcmChunk.readFrames(readFrames - read);
          let payload = new Int16Array(pcmBuffer);
          for (let i = 0; i < payload.length; i += 2) {
            read++;
            left[pos] = (payload[i] / 32768);
            right[pos] = (payload[i + 1] / 32768);
            if ((everyN != 0) && (read % everyN == 0)) {
              if (addFrames > 0) {
                pos--;
              }
              else {
                left[pos + 1] = left[pos];
                right[pos + 1] = right[pos];
                pos++;
              }
            }
            pos++;
          }
          if (pcmChunk.isEndOfChunk()) {
            this.chunk = this.chunks.shift();
          }
        }
        if (addFrames != 0)
          console.debug("Pos: " + pos + ", frames: " + frames + ", add: " + addFrames + ", everyN: " + everyN);
        if (read == readFrames)
          read = frames;
      }
    }
    if (read < frames) {
      console.warn("Failed to get chunk, read: " + read + "/" + frames + ", chunks left: " + this.chunks.length);
      left.fill(0, pos);
      right.fill(0, pos);
    }
    buffer.copyToChannel(left, 0, 0);
    buffer.copyToChannel(right, 1, 0);
  }
}
class TimeProvider {
  constructor(ctx = undefined) {
    this.diffBuffer = new Array();
    this.diff = 0;
    if (ctx) {
      this.setAudioContext(ctx);
    }
  }
  setAudioContext(ctx) {
    this.ctx = ctx;
    this.reset();
  }
  reset() {
    this.diffBuffer.length = 0;
    this.diff = 0;
  }
  setDiff(c2s, s2c) {
    if (this.now() == 0) {
      this.reset();
    }
    else {
      if (this.diffBuffer.push((c2s - s2c) / 2) > 100)
        this.diffBuffer.shift();
      let sorted = [...this.diffBuffer];
      sorted.sort();
      this.diff = sorted[Math.floor(sorted.length / 2)];
    }
  }
  now() {
    if (!this.ctx) {
      return window.performance.now();
    }
    else {
      return this.ctx.currentTime * 1000;
    }
  }
  nowSec() {
    return this.now() / 1000;
  }
  serverNow() {
    return this.serverTime(this.now());
  }
  serverTime(localTimeMs) {
    return localTimeMs + this.diff;
  }
}
class SampleFormat {
  constructor() {
    this.rate = 44100;
    this.channels = 2;
    this.bits = 16;
  }
  msRate() {
    return this.rate / 1000;
  }
  toString() {
    return this.rate + ":" + this.bits + ":" + this.channels;
  }
  sampleSize() {
    if (this.bits == 24) {
      return 4;
    }
    return this.bits / 8;
  }
  frameSize() {
    return this.channels * this.sampleSize();
  }
  durationMs(bytes) {
    return (bytes / this.frameSize()) * this.msRate();
  }
}
class Decoder {
  setHeader(buffer) {
    return new SampleFormat();
  }
  decode(chunk) {
    return null;
  }
}
class OpusDecoder extends Decoder {
  constructor() {
    super();
  }
  setHeader(buffer) {
    let view = new DataView(buffer);
    let ID_OPUS = 0x4F505553;
    if (buffer.byteLength < 12) {
      console.error("Opus header too small: " + buffer.byteLength);
      return null;
    }
    else if (view.getUint32(0, true) != ID_OPUS) {
      console.error("Opus header too small: " + buffer.byteLength);
      return null;
    }
    let format = new SampleFormat();
    format.rate = view.getUint32(4, true);
    format.bits = view.getUint16(8, true);
    format.channels = view.getUint16(10, true);
    console.log("Opus samplerate: " + format.toString());
    return format;
  }
  decode(chunk) {
    return null;
  }
}
class FlacDecoder extends Decoder {
  constructor() {
    super();
    this.header = null;
    this.cacheInfo = { isCachedChunk: false, cachedBlocks: 0 };
    this.decoder = Flac.create_libflac_decoder(true);
    if (this.decoder) {
      let init_status = Flac.init_decoder_stream(this.decoder, this.read_callback_fn.bind(this), this.write_callback_fn.bind(this), this.error_callback_fn.bind(this), this.metadata_callback_fn.bind(this), false);
      console.log("Flac init: " + init_status);
      Flac.setOptions(this.decoder, { analyseSubframes: true, analyseResiduals: true });
    }
    this.sampleFormat = new SampleFormat();
    this.flacChunk = new ArrayBuffer(0);
  }
  decode(chunk) {
    this.flacChunk = chunk.payload.slice(0);
    this.pcmChunk = chunk;
    this.pcmChunk.clearPayload();
    this.cacheInfo = { cachedBlocks: 0, isCachedChunk: true };
    while (this.flacChunk.byteLength && Flac.FLAC__stream_decoder_process_single(this.decoder)) {
      let state = Flac.FLAC__stream_decoder_get_state(this.decoder);
    }
    if (this.cacheInfo.cachedBlocks > 0) {
      let diffMs = this.cacheInfo.cachedBlocks / this.sampleFormat.msRate();
      this.pcmChunk.timestamp.setMilliseconds(this.pcmChunk.timestamp.getMilliseconds() - diffMs);
    }
    return this.pcmChunk;
  }
  read_callback_fn(bufferSize) {
    if (this.header) {
      console.log("  header: " + this.header.byteLength);
      let data = new Uint8Array(this.header);
      this.header = null;
      return { buffer: data, readDataLength: data.byteLength, error: false };
    }
    else if (this.flacChunk) {
      // a fresh read => next call to write will not be from cached data
      this.cacheInfo.isCachedChunk = false;
      let data = new Uint8Array(this.flacChunk.slice(0, Math.min(bufferSize, this.flacChunk.byteLength)));
      this.flacChunk = this.flacChunk.slice(data.byteLength);
      return { buffer: data, readDataLength: data.byteLength, error: false };
    }
    return { buffer: new Uint8Array(0), readDataLength: 0, error: false };
  }
  write_callback_fn(data, frameInfo) {
    if (this.cacheInfo.isCachedChunk) {
      // there was no call to read, so it's some cached data
      this.cacheInfo.cachedBlocks += frameInfo.blocksize;
    }
    let payload = new ArrayBuffer((frameInfo.bitsPerSample / 8) * frameInfo.channels * frameInfo.blocksize);
    let view = new DataView(payload);
    for (let channel = 0; channel < frameInfo.channels; ++channel) {
      let channelData = new DataView(data[channel].buffer, 0, data[channel].buffer.byteLength);
      for (let i = 0; i < frameInfo.blocksize; ++i) {
        view.setInt16(2 * (frameInfo.channels * i + channel), channelData.getInt16(2 * i, true), true);
      }
    }
    this.pcmChunk.addPayload(payload);
  }
  /** @memberOf decode */
  metadata_callback_fn(data) {
    console.info('meta data: ', data);
    this.sampleFormat.rate = data.sampleRate;
    this.sampleFormat.channels = data.channels;
    this.sampleFormat.bits = data.bitsPerSample;
    console.log("metadata_callback_fn, sampleformat: " + this.sampleFormat.toString());
  }
  /** @memberOf decode */
  error_callback_fn(err, errMsg) {
    console.error('decode error callback', err, errMsg);
  }
  setHeader(buffer) {
    this.header = buffer.slice(0);
    Flac.FLAC__stream_decoder_process_until_end_of_metadata(this.decoder);
    return this.sampleFormat;
  }
}
class PlayBuffer {
  constructor(buffer, playTime, source, destination) {
    this.num = 0;
    this.buffer = buffer;
    this.playTime = playTime;
    this.source = source;
    this.source.buffer = this.buffer;
    this.source.connect(destination);
    this.onended = (playBuffer) => { };
  }
  start() {
    this.source.onended = (ev) => {
      this.onended(this);
    };
    this.source.start(this.playTime);
  }
}
class PcmDecoder extends Decoder {
  setHeader(buffer) {
    let sampleFormat = new SampleFormat();
    let view = new DataView(buffer);
    sampleFormat.channels = view.getUint16(22, true);
    sampleFormat.rate = view.getUint32(24, true);
    sampleFormat.bits = view.getUint16(34, true);
    return sampleFormat;
  }
  decode(chunk) {
    return chunk;
  }
}
class SnapStream {
  constructor(uri) {
    this.playTime = 0;
    this.msgId = 0;
    this.bufferDurationMs = 80;
    this.bufferFrameCount = 3844;
    this.syncHandle = -1;
    this.audioBuffers = new Array();
    this.freeBuffers = new Array();
    this.audioBufferCount = 3;
    this.bufferMs = 1000;
    this.bufferNum = 0;
    this.onContextReady = null;
    this.streamsocket = new WebSocket(uri);
    this.streamsocket.binaryType = "arraybuffer";
    this.streamsocket.onmessage = (msg) => {
      let view = new DataView(msg.data);
      let type = view.getUint16(0, true);
      if (type == 1) {
        let codec = new CodecMessage(msg.data);
        console.log("Codec: " + codec.codec);
        if (codec.codec == "flac") {
          this.decoder = new FlacDecoder();
        }
        else if (codec.codec == "pcm") {
          this.decoder = new PcmDecoder();
        }
        else if (codec.codec == "opus") {
          this.decoder = new OpusDecoder();
          console.error("Codec not supported: ", codec.codec);
        }
        else {
          console.error("Codec not supported: ", codec.codec);
        }
        if (this.decoder) {
          this.sampleFormat = this.decoder.setHeader(codec.payload);
          console.log("Sampleformat: " + this.sampleFormat.toString());
          if ((this.sampleFormat.channels != 2) || (this.sampleFormat.bits != 16)) {
            console.error("Stream must be stereo with 16 bit depth, actual format: ", this.sampleFormat.toString());
          }
          else {
            if (this.bufferDurationMs != 0) {
              this.bufferFrameCount = Math.floor(this.bufferDurationMs * this.sampleFormat.msRate());
            }
            this.stopAudio();
            // LG webkit does not support AudioContext option argument.
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.timeProvider.setAudioContext(this.ctx);
            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.ctx.destination);
            this.gainNode.gain.value = this.serverSettings.muted ? 0 : this.serverSettings.volumePercent / 100;
            this.stream = new AudioStream(this.timeProvider, this.sampleFormat, this.bufferMs);
            if (!!this.onContextReady) this.onContextReady();
            this.play();
          }
        }
      }
      else if (type == 2) {
        let pcmChunk = new PcmChunkMessage(msg.data, this.sampleFormat);
        if (this.decoder) {
          let decoded = this.decoder.decode(pcmChunk);
          if (decoded) {
            this.stream.addChunk(decoded);
          }
        }
      }
      else if (type == 3) {
        this.serverSettings = new ServerSettingsMessage(msg.data);
        this.serverSettings.latency = 250;
        if (this.gainNode) {
          this.gainNode.gain.value = this.serverSettings.muted ? 0 : this.serverSettings.volumePercent / 100;
        }
        this.bufferMs = this.serverSettings.bufferMs - this.serverSettings.latency;
        console.log("ServerSettings bufferMs: " + this.serverSettings.bufferMs + ", latency: " + this.serverSettings.latency + ", volume: " + this.serverSettings.volumePercent + ", muted: " + this.serverSettings.muted);
      }
      else if (type == 4) {
        if (this.timeProvider) {
          let time = new TimeMessage(msg.data);
          this.timeProvider.setDiff(time.latency.getMilliseconds(), this.timeProvider.now() - time.sent.getMilliseconds());
        }
      }
      else {
        console.info("Message not handled, type: " + type);
      }
    };
    this.streamsocket.onopen = (ev) => {
      let hello = new HelloMessage();
      hello.mac = "00:00:00:00:00:00";
      hello.arch = "web";
      hello.os = navigator.platform;
      hello.hostname = "LG TV";
      // https://xkcd.com/221/
      hello.uniqueId = "d04dab75-ab9a-4628-821d-130f8bd2b3f8";
      this.sendMessage(hello);
      this.syncTime();
      this.syncHandle = window.setInterval(() => this.syncTime(), 1000);
    };
    this.streamsocket.onerror = (ev) => { console.error(ev.type); };
    this.streamsocket.onclose = (ev) => { stop(); };
    this.timeProvider = new TimeProvider();
  }
  sendMessage(msg) {
    msg.sent = new Tv(0, 0);
    msg.sent.setMilliseconds(this.timeProvider.now());
    msg.id = ++this.msgId;
    if (this.streamsocket.readyState != this.streamsocket.OPEN) {
      stop();
    }
    else {
      this.streamsocket.send(msg.serialize());
    }
  }
  syncTime() {
    let t = new TimeMessage();
    t.latency.setMilliseconds(this.timeProvider.now());
    this.sendMessage(t);
  }
  stopAudio() {
    if (this.ctx) {
      this.ctx.close();
    }
    while (this.audioBuffers.length > 0) {
      let buffer = this.audioBuffers.pop();
      buffer.onended = (playBuffer) => { };
      buffer.source.stop();
    }
    while (this.freeBuffers.length > 0) {
      this.freeBuffers.pop();
    }
  }
  stop() {
    window.clearInterval(this.syncHandle);
    this.stopAudio();
    if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(this.streamsocket.readyState)) {
      this.streamsocket.close();
    }
  }
  play() {
    this.playTime = this.timeProvider.nowSec() + 0.1;
    for (let i = 1; i <= this.audioBufferCount; ++i) {
      this.playNext();
    }
  }
  playNext() {
    if (this.ctx.baseLatency === undefined || this.ctx.baseLatency === null) {
      this.ctx.baseLatency = 0;
    }
    let buffer = this.freeBuffers.pop() || this.ctx.createBuffer(this.sampleFormat.channels, this.bufferFrameCount, this.sampleFormat.rate);
    let playTimeMs = (this.playTime + this.ctx.baseLatency) * 1000 - this.bufferMs;
    this.stream.getNextBuffer(buffer, playTimeMs);
    let source = this.ctx.createBufferSource();
    let playBuffer = new PlayBuffer(buffer, this.playTime, source, this.gainNode);
    this.audioBuffers.push(playBuffer);
    playBuffer.num = ++this.bufferNum;
    playBuffer.onended = (buffer) => {
      this.freeBuffers.push(this.audioBuffers.splice(this.audioBuffers.indexOf(buffer), 1)[0].buffer);
      this.playNext();
    };
    playBuffer.start();
    this.playTime += this.bufferFrameCount / this.sampleFormat.rate;
  }
}
//# sourceMappingURL=snapstream.js.map
