const fs = require('fs');
const crypto = require('crypto');
const bencode = require('bencode');

const torrentFile = './sample_torrent/Forager.v4.1.8-GOG.torrent';

// 토렌트 파일 읽기
const torrentBuffer = fs.readFileSync(torrentFile);
console.log(`토렌트 파일 크기: ${torrentBuffer.length} 바이트`);

// 파일의 내용 분석
try {
    // 전체 토렌트 파일 파싱
    const torrentData = bencode.decode(torrentBuffer);
    console.log('토렌트 파일 기본 구조:');
    
    // 토렌트 파일 구조 확인
    Object.keys(torrentData).forEach(key => {
        const value = torrentData[key];
        if (Buffer.isBuffer(value)) {
            console.log(`${key}: <Buffer> ${value.length} 바이트`);
        } else if (typeof value === 'number') {
            console.log(`${key}: ${value}`);
        } else if (Array.isArray(value)) {
            console.log(`${key}: <Array> ${value.length} 항목`);
        } else if (typeof value === 'object') {
            console.log(`${key}: <Object> ${Object.keys(value).length} 키`);
        } else {
            console.log(`${key}: ${value}`);
        }
    });
    
    // info 딕셔너리 추출 및 해시 계산
    if (torrentData.info) {
        console.log('\nInfo 딕셔너리 내용:');
        Object.keys(torrentData.info).forEach(key => {
            const value = torrentData.info[key];
            if (Buffer.isBuffer(value)) {
                console.log(`${key}: <Buffer> ${value.length} 바이트`);
            } else if (typeof value === 'number') {
                console.log(`${key}: ${value}`);
            } else if (Array.isArray(value)) {
                console.log(`${key}: <Array> ${value.length} 항목`);
            } else if (typeof value === 'object') {
                console.log(`${key}: <Object> ${Object.keys(value).length} 키`);
            } else {
                console.log(`${key}: ${value}`);
            }
        });
        
        // info 딕셔너리만 다시 bencode로 인코딩
        const infoEncoded = bencode.encode(torrentData.info);
        
        // info 딕셔너리의 SHA-1 해시 계산
        const hash = crypto.createHash('sha1').update(infoEncoded).digest('hex');
        console.log(`\nBencode 라이브러리로 계산한 Info Hash: ${hash}`);
        
        // 목표 해시와 비교
        const targetHash = 'b054121e4f55682d8487b6e98bfc33a6420d609e';
        console.log(`목표 해시: ${targetHash}`);
        console.log(`해시 일치 여부: ${hash === targetHash}`);
        
        // 인코딩된 info 딕셔너리 저장
        fs.writeFileSync('bencode_info_dict.bin', infoEncoded);
        console.log('인코딩된 info 딕셔너리를 bencode_info_dict.bin 파일로 저장했습니다.');
    } else {
        console.error('토렌트 파일에 info 딕셔너리가 없습니다.');
    }
    
    // 원본 토렌트 파일에서 직접 info 딕셔너리 위치 찾기 시도
    console.log('\n원본 데이터에서 info 딕셔너리 위치 찾기...');
    
    // 원본 데이터에서 info 딕셔너리를 인코딩된 형태로 찾기
    const infoValue = bencode.encode(torrentData.info);
    console.log(`인코딩된 info 딕셔너리 크기: ${infoValue.length} 바이트`);
    
    // 첫 몇 바이트 출력
    console.log('인코딩된 info 딕셔너리 시작:');
    console.log(infoValue.slice(0, 50).toString('hex'));
    
    // 원본 데이터에서 인코딩된 info 딕셔너리 위치 찾기
    let infoPos = -1;
    for (let i = 0; i < torrentBuffer.length - infoValue.length; i++) {
        let match = true;
        for (let j = 0; j < Math.min(50, infoValue.length); j++) {
            if (torrentBuffer[i + j] !== infoValue[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            infoPos = i;
            break;
        }
    }
    
    if (infoPos !== -1) {
        console.log(`원본 데이터에서 info 딕셔너리 위치: ${infoPos}`);
        
        // 찾은 위치에서 info 딕셔너리 추출
        const extractedInfo = torrentBuffer.slice(infoPos, infoPos + infoValue.length);
        const extractedHash = crypto.createHash('sha1').update(extractedInfo).digest('hex');
        console.log(`추출된 info 딕셔너리의 해시: ${extractedHash}`);
        console.log(`목표 해시와 일치 여부: ${extractedHash === targetHash}`);
    } else {
        console.log('원본 데이터에서 info 딕셔너리를 찾을 수 없습니다.');
    }
    
    // 직접 파싱 시도
    console.log('\n직접 파싱 시도...');
    
    // 원본 토렌트 파일에서 info 딕셔너리의 위치를 찾기
    // bencoded 토렌트 구조: d(딕셔너리 시작) + 키 + 값 + ... + e(딕셔너리 끝)
    
    // 바이너리 데이터를 문자열로 변환 (이진 데이터 손실 없이)
    const torrentData2 = Buffer.from(torrentBuffer);
    
    // '4:info' 패턴 찾기
    const searchPattern = Buffer.from('4:info');
    let infoKeyPos = -1;
    
    for (let i = 0; i <= torrentData2.length - searchPattern.length; i++) {
        let found = true;
        for (let j = 0; j < searchPattern.length; j++) {
            if (torrentData2[i + j] !== searchPattern[j]) {
                found = false;
                break;
            }
        }
        if (found) {
            infoKeyPos = i;
            break;
        }
    }
    
    if (infoKeyPos !== -1) {
        console.log(`'4:info' 패턴 발견: 위치 ${infoKeyPos}`);
        
        // info 키워드 다음에 나오는 값이 딕셔너리인지 확인
        const valueStart = infoKeyPos + searchPattern.length;
        
        if (torrentData2[valueStart] === 100) { // 'd' ASCII
            console.log(`info 딕셔너리 시작: 위치 ${valueStart}`);
            
            // 딕셔너리의 끝 찾기 (중첩된 구조 고려)
            let depth = 1;
            let endPos = valueStart + 1;
            
            while (depth > 0 && endPos < torrentData2.length) {
                const byte = torrentData2[endPos];
                
                if (byte === 100 || byte === 108) { // 'd' 또는 'l'
                    depth++;
                } else if (byte === 101) { // 'e'
                    depth--;
                }
                
                endPos++;
            }
            
            if (depth === 0) {
                console.log(`info 딕셔너리 끝: 위치 ${endPos - 1}`);
                
                // 해당 바이트를 추출하여 해시 계산
                const directInfoDict = torrentData2.slice(valueStart, endPos);
                const directHash = crypto.createHash('sha1').update(directInfoDict).digest('hex');
                
                console.log(`직접 추출된 info 딕셔너리 해시: ${directHash}`);
                console.log(`목표 해시와 일치 여부: ${directHash === targetHash}`);
                
                // 추출된 딕셔너리 저장
                fs.writeFileSync('direct_info_dict.bin', directInfoDict);
                console.log('직접 추출한 info 딕셔너리를 direct_info_dict.bin 파일로 저장했습니다.');
                
                // 바이트 수준에서 차이점 확인
                if (directHash !== targetHash) {
                    console.log('\n해시 불일치 분석:');
                    console.log(`직접 추출 크기: ${directInfoDict.length} 바이트`);
                    
                    // 다양한 범위로 시도
                    for (let offset = -5; offset <= 5; offset++) {
                        if (offset === 0) continue;
                        
                        const adjustedStart = offset < 0 ? valueStart + offset : valueStart;
                        const adjustedEnd = offset > 0 ? endPos + offset : endPos;
                        
                        if (adjustedStart >= 0 && adjustedEnd <= torrentData2.length) {
                            const adjustedDict = torrentData2.slice(adjustedStart, adjustedEnd);
                            const adjustedHash = crypto.createHash('sha1').update(adjustedDict).digest('hex');
                            
                            console.log(`조정 범위(${offset}): ${adjustedStart}-${adjustedEnd}, 해시: ${adjustedHash}`);
                            console.log(`목표 해시와 일치 여부: ${adjustedHash === targetHash}`);
                            
                            if (adjustedHash === targetHash) {
                                fs.writeFileSync(`adjusted_info_dict_${offset}.bin`, adjustedDict);
                                console.log(`조정된 info 딕셔너리를 adjusted_info_dict_${offset}.bin 파일로 저장했습니다.`);
                            }
                        }
                    }
                }
            }
        }
    }
} catch (error) {
    console.error('토렌트 파일 분석 중 오류 발생:', error);
} 