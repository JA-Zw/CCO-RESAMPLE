// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'kaitai-struct/KaitaiStream'], factory);
  } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeType !== 'number') {
    factory(exports, require('kaitai-struct/KaitaiStream'));
  } else {
    factory(root.RiffWav || (root.RiffWav = {}), root.KaitaiStream);
  }
})(typeof self !== 'undefined' ? self : this, function (RiffWav_, KaitaiStream) {
var RiffWav = (function() {
  function RiffWav(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  RiffWav.prototype._read = function() {
    this.riff = this._io.readBytes(4);
    if (!((KaitaiStream.byteArrayCompare(this.riff, new Uint8Array([82, 73, 70, 70])) == 0))) {
      throw new KaitaiStream.ValidationNotEqualError(new Uint8Array([82, 73, 70, 70]), this.riff, this._io, "/seq/0");
    }
    this.grootteInh = this._io.readU4le();
    this.wave = this._io.readBytes(4);
    if (!((KaitaiStream.byteArrayCompare(this.wave, new Uint8Array([87, 65, 86, 69])) == 0))) {
      throw new KaitaiStream.ValidationNotEqualError(new Uint8Array([87, 65, 86, 69]), this.wave, this._io, "/seq/2");
    }
    this._raw_inhoud = this._io.readBytes(this.grootteInh - 4);
    var _io__raw_inhoud = new KaitaiStream(this._raw_inhoud);
    this.inhoud = new Inhoud(_io__raw_inhoud, this, this._root);
  }

  var Blok = RiffWav.Blok = (function() {
    function Blok(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Blok.prototype._read = function() {
      this.id = KaitaiStream.bytesToStr(this._io.readBytes(4), "UTF-8");
      this.grootte = this._io.readU4le();
      switch (this.id) {
      case "data":
        this._raw_inhoud = this._io.readBytes(this.grootte);
        var _io__raw_inhoud = new KaitaiStream(this._raw_inhoud);
        this.inhoud = new Bytes(_io__raw_inhoud, this, this._root);
        break;
      case "fact":
        this._raw_inhoud = this._io.readBytes(this.grootte);
        var _io__raw_inhoud = new KaitaiStream(this._raw_inhoud);
        this.inhoud = new Fact(_io__raw_inhoud, this, this._root);
        break;
      case "fmt ":
        this._raw_inhoud = this._io.readBytes(this.grootte);
        var _io__raw_inhoud = new KaitaiStream(this._raw_inhoud);
        this.inhoud = new Format(_io__raw_inhoud, this, this._root, this.grootte);
        break;
      default:
        this._raw_inhoud = this._io.readBytes(this.grootte);
        var _io__raw_inhoud = new KaitaiStream(this._raw_inhoud);
        this.inhoud = new Bytes(_io__raw_inhoud, this, this._root);
        break;
      }
    }

    return Blok;
  })();

  var Bytes = RiffWav.Bytes = (function() {
    function Bytes(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Bytes.prototype._read = function() {
      this.inhoud = this._io.readBytesFull();
    }

    return Bytes;
  })();

  var Fact = RiffWav.Fact = (function() {
    function Fact(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Fact.prototype._read = function() {
      this.totaalSamples = this._io.readU4le();
    }

    return Fact;
  })();

  var Format = RiffWav.Format = (function() {
    function Format(_io, _parent, _root, grootte) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;
      this.grootte = grootte;

      this._read();
    }
    Format.prototype._read = function() {
      this.format = this._io.readU2le();
      this.kanalen = this._io.readU2le();
      this.sampleRate = this._io.readU4le();
      this.byteRate = this._io.readU4le();
      this.blokGrootte = this._io.readU2le();
      this.bitsPerSample = this._io.readU2le();
      if (this.grootte > 16) {
        this.bonusDataGrootte = this._io.readU2le();
      }
      if ( ((this.grootte > 16) && (this.bonusDataGrootte >= 2)) ) {
        this.nuttigeBits = this._io.readU2le();
      }
      if ( ((this.grootte > 16) && (this.bonusDataGrootte >= 4)) ) {
        this.kanaalLuidspreker = this._io.readU2le();
      }
      if ( ((this.grootte > 16) && (this.bonusDataGrootte >= 6)) ) {
        this.werkelijkFormat = this._io.readU2le();
      }
    }

    return Format;
  })();

  var Inhoud = RiffWav.Inhoud = (function() {
    function Inhoud(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root;

      this._read();
    }
    Inhoud.prototype._read = function() {
      this.blokken = [];
      var i = 0;
      while (!this._io.isEof()) {
        this.blokken.push(new Blok(this._io, this, this._root));
        i++;
      }
    }

    return Inhoud;
  })();

  return RiffWav;
})();
RiffWav_.RiffWav = RiffWav;
});
