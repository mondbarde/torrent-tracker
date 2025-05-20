var Bencode = {};

Bencode.encode = function(obj) {
  switch (getType(obj)) {
  case "string":
    return obj.length + ":" + obj;
  case "number":
    return "i" + obj + "e";
  case "array":
    var ret = "l";
    for (var i = 0; i < obj.length; i++) {
      ret += Bencode.encode(obj[i]);
    }
    return ret + "e";
  case "object":
    var ret = "d";
    var keys = Object.keys(obj).sort(); // 키는 항상 정렬되어야 함
    for (var i = 0; i < keys.length; i++) {
      ret += Bencode.encode(keys[i]) + Bencode.encode(obj[keys[i]]);
    }
    return ret + "e";
  default:
    return ""; // Should not happen
  }
};

Bencode.decode = function(str) {
  var dec = decodeInternal(str, 0);
  if (dec == null || dec.offset != str.length) {
    throw "Invalid format";
  }
  return dec.obj;
};

function getType(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

function decodeInternal(data, offset) {
  if (offset >= data.length) return null;

  var obj, len, newOffset;
  switch (data[offset]) {
  case 'i':
    var match = data.substring(offset).match(/^i(-?\d+)e/);
    if (match == null) return null;
    obj = parseInt(match[1]);
    newOffset = offset + match[0].length;
    break;
  case 'l':
    obj = [];
    newOffset = offset + 1;
    while (newOffset < data.length && data[newOffset] != 'e') {
      var dec = decodeInternal(data, newOffset);
      if (dec == null) return null;
      obj.push(dec.obj);
      newOffset = dec.offset;
    }
    if (newOffset >= data.length && data[newOffset] != 'e') return null;
    newOffset++;
    break;
  case 'd':
    obj = {};
    newOffset = offset + 1;
    while (newOffset < data.length && data[newOffset] != 'e') {
      var keyDec = decodeInternal(data, newOffset);
      if (keyDec == null || getType(keyDec.obj) != "string") return null;
      var valDec = decodeInternal(data, keyDec.offset);
      if (valDec == null) return null;
      obj[keyDec.obj] = valDec.obj;
      newOffset = valDec.offset;
    }
    if (newOffset >= data.length && data[newOffset] != 'e') return null;
    newOffset++;
    break;
  default: // String
    var match = data.substring(offset).match(/^(\d+):/);
    if (match == null) return null;
    len = parseInt(match[1]);
    newOffset = offset + match[0].length + len;
    if (newOffset > data.length) return null;
    obj = data.substring(offset + match[0].length, newOffset);
    break;
  }
  return {obj: obj, offset: newOffset};
} 