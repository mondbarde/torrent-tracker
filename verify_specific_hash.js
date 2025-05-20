const fs = require('fs');
const crypto = require('crypto');
const bencoding = require('bencoding');

// 토렌트 파일 경로
const torrentFilePath = 'sample_torrent/더 라스트 오브 어스 시즌2 E06 2025.[자체자막] .10800p.KORSUB.WEBRip.H264.AAC.torrent.torrent';
const expectedHash = 'bdeb09256e05ea98d659fd1282692c1a69c4eaa6';

try {
    // 1. 토렌트 파일 읽기 (바이너리)
    const torrentFileBuffer = fs.readFileSync(torrentFilePath);

    // 2. 전체 토렌트 데이터 디코딩
    const decodedTorrent = bencoding.decode(torrentFileBuffer);

    let infoObject = null;
    const infoKeyBuffer = Buffer.from('info');

    if (decodedTorrent && decodedTorrent.keys && decodedTorrent.vals) { // BDict 객체 구조 확인
        const keyIndex = decodedTorrent.keys.findIndex(key => infoKeyBuffer.equals(key));
        if (keyIndex !== -1) {
            infoObject = decodedTorrent.vals[keyIndex];
        }
    }

    if (!infoObject) {
        console.error('Decoded torrent object structure:', JSON.stringify(decodedTorrent, null, 2));
        // bencoding 라이브러리가 반환하는 객체 구조를 좀 더 자세히 보기 위해 Buffer를 문자열로 변환 (주의: 모든 Buffer가 UTF-8은 아님)
        if (decodedTorrent && decodedTorrent.keys) {
            console.error('Keys in decoded object:', decodedTorrent.keys.map(k => k.toString()));
        }
        throw new Error("'info' 딕셔너리를 토렌트 파일에서 찾을 수 없습니다. BDict 구조에서 키를 찾지 못했습니다.");
    }
    
    // infoObject가 BDict 인스턴스일 경우 일반 객체로 변환해야 bencoding.encode가 제대로 처리할 수 있음
    // bencoding.encode는 일반 객체나 Buffer를 기대함.
    // BDict를 일반 객체로 변환하는 함수
    function convertBdictToPlainObject(bdict) {
        if (bdict && bdict.keys && bdict.vals) {
            const plainObject = {};
            for (let i = 0; i < bdict.keys.length; i++) {
                const key = bdict.keys[i].toString(); // 키는 문자열로
                let value = bdict.vals[i];
                if (Buffer.isBuffer(value)) {
                    // piece_hash와 같은 바이너리 데이터는 Buffer 그대로 유지
                    // path와 같은 문자열 리스트 내부의 문자열도 Buffer로 올 수 있음
                    // Bencode 명세상 문자열은 바이트 문자열임.
                    // bencoding.encode는 Buffer 문자열을 올바르게 처리함.
                } else if (Array.isArray(value)) {
                    value = value.map(item => convertBdictToPlainObject(item) || item);
                } else if (value && value.keys && value.vals) { // 중첩된 BDict
                    value = convertBdictToPlainObject(value);
                }
                plainObject[key] = value;
            }
            return plainObject;
        }
        return bdict; // BDict가 아니면 그대로 반환
    }

    const plainInfoObject = convertBdictToPlainObject(infoObject);

    const correctlyBencodedInfoBuffer = bencoding.encode(plainInfoObject);

    const sha1sum = crypto.createHash('sha1');
    sha1sum.update(correctlyBencodedInfoBuffer);
    const calculatedHash = sha1sum.digest('hex');

    console.log(`토렌트 파일: ${torrentFilePath}`);
    console.log(`계산된 Info Hash: ${calculatedHash}`);
    console.log(`예상 Info Hash: ${expectedHash}`);
    console.log(`일치 여부: ${calculatedHash.toLowerCase() === expectedHash.toLowerCase() ? '일치' : '불일치'}`);

} catch (error) {
    console.error('오류 발생:', error);
} 